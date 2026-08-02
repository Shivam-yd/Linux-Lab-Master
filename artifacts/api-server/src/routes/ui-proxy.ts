import { Router, type IRouter, type Request } from "express";
import http from "node:http";
import zlib from "node:zlib";
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

  const container = await getRunningContainer(req.studentId, labId);
  if (!container) {
    res.status(503).json({ error: "Lab session is not running" });
    return;
  }

  const info = await container.inspect();
  const containerPort = lab.ports[0];
  const bindings = (info.NetworkSettings.Ports as Record<string, { HostPort: string }[] | null>)[`${containerPort}/tcp`];
  const hostPort = bindings?.[0]?.HostPort;
  const networks = info.NetworkSettings.Networks as Record<string, { IPAddress?: string }> | undefined;
  const containerIp = Object.values(networks ?? {})
    .map((network) => network.IPAddress)
    .find((ip): ip is string => Boolean(ip));

  if (!containerIp && !hostPort) {
    res.status(503).json({ error: "Container UI port is not available yet" });
    return;
  }

  // proxyPrefix is the path prefix the browser uses to reach this proxy.
  // All /jenkins/* links must be rewritten to go through this prefix.
  const proxyPrefix = `/api/labs/${labId}/ui`;
  const proxyPath = req.url || "/";

  const target = containerIp
    ? { hostname: containerIp, port: containerPort, label: `container ${containerIp}:${containerPort}` }
    : { hostname: "127.0.0.1", port: Number(hostPort), label: `host port ${hostPort}` };

  // Strip Accept-Encoding so Jenkins never sends gzip/brotli — compressed
  // bytes can't be string-replaced for path rewriting.
  const headers: Record<string, string | string[] | undefined> = { ...req.headers };
  headers["host"] = `localhost:${containerPort}`;
  headers["accept-encoding"] = "identity";
  delete (headers as Record<string, unknown>)["content-length"];

  const proxyReq = http.request(
    { hostname: target.hostname, port: target.port, path: proxyPath, method: req.method, headers },
    (proxyRes) => {
      // ── Location header rewrite ────────────────────────────────────────────
      // Handle both absolute (http://any-host/jenkins/...) and relative
      // (/jenkins/...) forms that Jenkins may emit.
      if (proxyRes.headers["location"]) {
        proxyRes.headers["location"] = proxyRes.headers["location"]
          // Absolute: strip scheme + host, keep path portion starting at /jenkins
          .replace(/^https?:\/\/[^/]+\/jenkins(?=\/|$)/, `${proxyPrefix}/jenkins`)
          // Relative: plain /jenkins/... path
          .replace(/^\/jenkins(?=\/|$)/, `${proxyPrefix}/jenkins`);
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
          const rewritten = text.split("/jenkins").join(`${proxyPrefix}/jenkins`);
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

  proxyReq.on("error", (err) => {
    logger.warn(
      { err, labId, studentId: req.studentId, target: target.label, proxyPath },
      "UI proxy upstream connection failed",
    );
    if (!res.headersSent) res.status(502).json({ error: "UI service is not reachable yet" });
  });

  // ── Request body forwarding ─────────────────────────────────────────────────
  // Use the raw body captured before Express parsing so that repeated/array
  // keys (Jenkins build-step lists, etc.) are forwarded verbatim.
  const method = req.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    const rawBody = (req as Request & { rawBody?: string }).rawBody;
    const ct = (req.headers["content-type"] ?? "").split(";")[0].trim();

    if (rawBody !== undefined && ct === "application/x-www-form-urlencoded") {
      // Verbatim raw body — preserves every key/value exactly as the browser sent it.
      proxyReq.setHeader("content-length", Buffer.byteLength(rawBody));
      proxyReq.write(rawBody);
    } else if (req.body && ct === "application/json") {
      const json = JSON.stringify(req.body);
      proxyReq.setHeader("content-length", Buffer.byteLength(json));
      proxyReq.write(json);
    }
    // Other content-types (multipart, etc.) are piped directly since Express
    // hasn't consumed them.
  }
  proxyReq.end();
});

export default router;
