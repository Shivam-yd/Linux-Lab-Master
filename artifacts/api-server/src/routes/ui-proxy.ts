import { Router, type IRouter, type Request } from "express";
import http from "node:http";
import { requireAuth } from "../middleware/auth";
import { getRunningContainer, getSessionRow } from "../lib/docker/manager";
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
 * in HTML and JS responses and Location headers so in-page navigation stays
 * inside the iframe rather than breaking out to the Replit root.
 *
 * Key behaviours:
 *  - Accept-Encoding stripped from upstream request so Jenkins never gzips —
 *    gzipped bytes can't be string-replaced for path rewrites.
 *  - Location header rewrites handle both absolute (http://host/jenkins/...)
 *    and relative (/jenkins/...) forms.
 *  - Form POST bodies forwarded verbatim via req.rawBody (set by app.ts verify
 *    callback) so repeated/array keys are never dropped by re-encoding.
 *  - HTML and JS responses rewritten; all other content types piped as-is.
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

  const session = await getSessionRow(req.studentId, labId);
  if (session?.status !== "running") {
    res.status(503).json({ error: "Lab UI is still provisioning" });
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

  // proxyPrefix is the path prefix the browser uses to reach this proxy.
  // All /jenkins/* links must be rewritten to go through this prefix.
  const proxyPrefix = `/api/labs/${labId}/ui`;
  // A request to the bare proxy endpoint has no Jenkins prefix. Use the
  // configured service path instead of forwarding "/" to Jenkins, which
  // returns 404 when started with --prefix=/jenkins.
  const configuredUiPath = lab.uiPath
    ?? (lab.image.startsWith("jenkins/") ? "/jenkins/" : undefined);
  const upstreamPrefix = configuredUiPath?.replace(/\/+$/, "") || "";
  const requestPath = (!req.url || req.url === "/") && configuredUiPath
    ? configuredUiPath
    : req.url || "/";
  // Jenkins occasionally emits root-relative links such as /job/... even
  // when it is running with --prefix=/jenkins. Normalize those escaped links
  // before forwarding so the upstream server does not return its own 404.
  const proxyPath = upstreamPrefix &&
    requestPath !== upstreamPrefix &&
    !requestPath.startsWith(`${upstreamPrefix}/`)
    ? `${upstreamPrefix}${requestPath.startsWith("/") ? requestPath : `/${requestPath}`}`
    : requestPath;

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
  const headers: Record<string, string | string[] | undefined> = { ...req.headers };
  headers["host"] = `localhost:${containerPort}`;
  headers["accept-encoding"] = "identity";
  delete (headers as Record<string, unknown>)["content-length"];

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
        proxyRes.headers["location"] = proxyRes.headers["location"]
          // Absolute: strip scheme + host, keep path portion starting at /jenkins
          .replace(/^https?:\/\/[^/]+\/jenkins(?=\/|$)/, `${proxyPrefix}/jenkins`)
          // Relative: plain /jenkins/... path
          .replace(/^\/jenkins(?=\/|$)/, `${proxyPrefix}/jenkins`)
          // Root-relative Jenkins redirects can omit the configured prefix.
          .replace(/^\/(?!jenkins(?=\/|$))/, `${proxyPrefix}${upstreamPrefix}/`);
      }

      // Strip headers that prevent iframing.
      delete proxyRes.headers["x-frame-options"];
      delete proxyRes.headers["content-security-policy"];

      // Rewrite Set-Cookie Path so the browser sends session cookies on
      // subsequent requests through the /api/labs/:labId/ui/... prefix.
      const rawCookies = proxyRes.headers["set-cookie"];
      if (rawCookies) {
        proxyRes.headers["set-cookie"] = (rawCookies as string[]).map((c) =>
          c
            .replace(/; Path=\/jenkins(?=;|$)/gi, `; Path=${proxyPrefix}/jenkins`)
            .replace(/; Path=\/(?=;|$)/gi, `; Path=${proxyPrefix}/`),
        );
      }

      const contentType = proxyRes.headers["content-type"] ?? "";
      const isHtml = contentType.includes("text/html");
      const isJs   = contentType.includes("javascript");

      if (isHtml || isJs) {
        // Buffer and rewrite text: replace every /jenkins occurrence with the
        // proxied path so in-page links and rootURL JS variable resolve correctly.
        // Because we stripped Accept-Encoding above, this is plain UTF-8 text.
        const chunks: Buffer[] = [];
        proxyRes.on("data", (c: Buffer) => chunks.push(c));
        proxyRes.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          const rewritten = text
            .split("/jenkins").join(`${proxyPrefix}/jenkins`)
            // Keep root-relative Jenkins links inside the lab proxy too.
            .replace(/([("'=])\/(?!jenkins(?=\/|["']|$))/g, `$1${proxyPrefix}${upstreamPrefix}/`);
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

    // Reconstruct the request body after Express parsed it. Prefer the raw
    // body so repeated form fields and Jenkins Stapler method invocations are
    // preserved exactly.
    const method = req.method.toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      const rawBody = (req as Request & { rawBody?: string }).rawBody;
      const ct = (req.headers["content-type"] ?? "").split(";")[0].trim();
      if (rawBody !== undefined) {
        proxyReq.setHeader("content-length", Buffer.byteLength(rawBody));
        proxyReq.write(rawBody);
      } else if (req.body && ct === "application/json") {
        const json = JSON.stringify(req.body);
        proxyReq.setHeader("content-length", Buffer.byteLength(json));
        proxyReq.write(json);
      }
    }
    proxyReq.end();
  };

  sendRequest(0);
});

export default router;
