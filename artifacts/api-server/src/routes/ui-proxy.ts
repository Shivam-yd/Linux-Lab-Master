import { Router, type IRouter } from "express";
import http from "node:http";
import { requireAuth } from "../middleware/auth";
import { getRunningContainer } from "../lib/docker/manager";
import { getLabByIdAsync } from "../lib/labs/registry";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * Transparent HTTP proxy for service-based lab UIs (e.g. Jenkins).
 *
 * Route: /labs/:labId/ui/* → proxied to the container's published port.
 *
 * Jenkins is configured with --prefix=/jenkins so all its internal links
 * are /jenkins/... The proxy rewrites those to /api/labs/:labId/ui/jenkins/...
 * in HTML responses and Location headers so in-page navigation stays inside
 * the iframe rather than breaking out to the Replit root.
 */
router.use("/labs/:labId/ui", requireAuth, async (req, res): Promise<void> => {
  const rawLabId = req.params.labId;
  const labId = Array.isArray(rawLabId) ? rawLabId[0] : rawLabId;
  if (!labId) {
    res.status(400).json({ error: "Lab ID is required" });
    return;
  }

  const lab = await getLabByIdAsync(labId);
  if (!lab?.ports?.[0]) {
    res.status(404).json({ error: "Lab has no UI port" });
    return;
  }

  const container = await getRunningContainer(req.studentId, labId);
  if (!container) {
    res.status(503).json({ error: "Lab session is not running" });
    return;
  }

  const info = await container.inspect();
  const containerPort = lab.ports[0];
  const bindings = (info.NetworkSettings.Ports as Record<string, { HostPort: string; HostIp?: string }[] | null>)[`${containerPort}/tcp`];
  const hostPort = bindings?.[0]?.HostPort;
  const networks = info.NetworkSettings.Networks as Record<string, { IPAddress?: string }> | undefined;
  const containerIp = Object.values(networks ?? {})
    .map((network) => network.IPAddress)
    .find((ip): ip is string => Boolean(ip));
  const dockerGateway = Object.values(networks ?? {})
    .map((network) => (network as { Gateway?: string }).Gateway)
    .find((ip): ip is string => Boolean(ip));
  const nodeIp = process.env.NODE_IP;

  // The API may run in a different container from the lab. In that layout,
  // localhost:<published-port> points back at the API container, not at the
  // Docker host where the lab port is published. In k3s, the API pod also
  // cannot always route to Docker's bridge IP, so try the node's host port
  // before falling back to the lab container IP and local development paths.
  if (!containerIp && !hostPort) {
    res.status(503).json({ error: "Container UI port is not available yet" });
    return;
  }

  // proxyPrefix is the path prefix that the browser uses to reach this proxy.
  // All absolute /jenkins/* links in Jenkins HTML need to be rewritten to
  // go through this prefix so they stay inside the iframe.
  const proxyPrefix = `/api/labs/${labId}/ui`;
  const proxyPath = req.url || "/";

  type ProxyTarget = { hostname: string; port: number; label: string };
  const targets: ProxyTarget[] = [];
  const addTarget = (target: ProxyTarget): void => {
    if (!targets.some((current) => current.hostname === target.hostname && current.port === target.port)) {
      targets.push(target);
    }
  };
  if (nodeIp && hostPort) {
    addTarget({ hostname: nodeIp, port: Number(hostPort), label: `node ${nodeIp}:${hostPort}` });
  }
  if (containerIp) {
    addTarget({ hostname: containerIp, port: containerPort, label: `container ${containerIp}:${containerPort}` });
  }
  if (dockerGateway && hostPort) {
    addTarget({ hostname: dockerGateway, port: Number(hostPort), label: `Docker gateway ${dockerGateway}:${hostPort}` });
  }
  if (hostPort) {
    addTarget({ hostname: "127.0.0.1", port: Number(hostPort), label: `host port ${hostPort}` });
  }
  const headers = { ...req.headers, host: `localhost:${containerPort}` };
  delete (headers as Record<string, unknown>)["content-length"];

  let requestBody: Buffer | undefined;
  const method = req.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD" && req.body) {
    const ct = (req.headers["content-type"] ?? "").split(";")[0].trim();
    if (ct === "application/x-www-form-urlencoded") {
      requestBody = Buffer.from(new URLSearchParams(req.body as Record<string, string>).toString());
    } else if (ct === "application/json") {
      requestBody = Buffer.from(JSON.stringify(req.body));
    }
  }

  const sendRequest = (targetIndex: number): void => {
    const target = targets[targetIndex];
    if (!target) {
      if (!res.headersSent) res.status(502).json({ error: "UI service is not reachable yet" });
      return;
    }

    const proxyReq = http.request(
      { hostname: target.hostname, port: target.port, path: proxyPath, method: req.method, headers },
      (proxyRes) => {
      // Rewrite redirect Location headers so the browser stays inside our proxy.
      if (proxyRes.headers["location"]) {
        proxyRes.headers["location"] = proxyRes.headers["location"].replace(
          /^\/jenkins/,
          `${proxyPrefix}/jenkins`,
        );
      }

      // Strip headers that prevent iframing.
      delete proxyRes.headers["x-frame-options"];
      delete proxyRes.headers["content-security-policy"];

      // Rewrite Set-Cookie Path so the browser sends session cookies on
      // subsequent requests through the /api/labs/:labId/ui/... prefix.
      // Without this, Jenkins sets Path=/jenkins but the browser only sends
      // that cookie for exact /jenkins/* paths, not /api/labs/.../ui/jenkins/*.
      const rawCookies = proxyRes.headers["set-cookie"];
      if (rawCookies) {
        proxyRes.headers["set-cookie"] = (rawCookies as string[]).map((c) =>
          c
            .replace(/; Path=\/jenkins(?=;|$)/gi, `; Path=${proxyPrefix}/jenkins`)
            .replace(/; Path=\/(?=;|$)/gi, `; Path=${proxyPrefix}/`),
        );
      }

      const contentType = proxyRes.headers["content-type"] ?? "";
      if (contentType.includes("text/html")) {
        // Buffer and rewrite HTML: replace every /jenkins path with the proxied
        // equivalent so in-page links resolve through our proxy.
        const chunks: Buffer[] = [];
        proxyRes.on("data", (c: Buffer) => chunks.push(c));
        proxyRes.on("end", () => {
          const html = Buffer.concat(chunks).toString("utf8");
          const rewritten = html.split("/jenkins").join(`${proxyPrefix}/jenkins`);
          const outHeaders = { ...proxyRes.headers };
          delete outHeaders["content-length"]; // byte length changed after rewrite
          res.writeHead(proxyRes.statusCode ?? 200, outHeaders);
          res.end(rewritten);
        });
      } else {
        res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
        proxyRes.pipe(res);
      }
      },
    );

    proxyReq.setTimeout(3_000, () => proxyReq.destroy(new Error("UI proxy upstream connection timed out")));
    proxyReq.on("error", (err) => {
      logger.warn(
        { err, labId, studentId: req.studentId, target: target.label, proxyPath },
        "UI proxy upstream connection failed",
      );
      sendRequest(targetIndex + 1);
    });

    if (requestBody) {
      proxyReq.setHeader("content-length", requestBody.length);
      proxyReq.write(requestBody);
    }
    proxyReq.end();
  };

  sendRequest(0);
});

export default router;
