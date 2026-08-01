import { Router, type IRouter } from "express";
import http from "node:http";
import { requireAuth } from "../middleware/auth";
import { getRunningContainer } from "../lib/docker/manager";
import { getLabByIdAsync } from "../lib/labs/registry";

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
  const { labId } = req.params;

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
  const bindings = (info.NetworkSettings.Ports as Record<string, { HostPort: string }[] | null>)[`${lab.ports[0]}/tcp`];
  const hostPort = bindings?.[0]?.HostPort;
  if (!hostPort) {
    res.status(503).json({ error: "Container port not yet bound" });
    return;
  }

  // proxyPrefix is the path prefix that the browser uses to reach this proxy.
  // All absolute /jenkins/* links in Jenkins HTML need to be rewritten to
  // go through this prefix so they stay inside the iframe.
  const proxyPrefix = `/api/labs/${labId}/ui`;
  const proxyPath = req.url || "/";

  const headers = { ...req.headers, host: `localhost:${hostPort}` };
  delete (headers as Record<string, unknown>)["content-length"];

  const proxyReq = http.request(
    { hostname: "localhost", port: Number(hostPort), path: proxyPath, method: req.method, headers },
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

  proxyReq.on("error", () => {
    if (!res.headersSent) res.status(502).json({ error: "UI proxy error" });
  });

  // Reconstruct the request body (express.json/urlencoded already consumed the stream).
  const method = req.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD" && req.body) {
    const ct = (req.headers["content-type"] ?? "").split(";")[0].trim();
    if (ct === "application/x-www-form-urlencoded") {
      const encoded = new URLSearchParams(req.body as Record<string, string>).toString();
      proxyReq.setHeader("content-length", Buffer.byteLength(encoded));
      proxyReq.write(encoded);
    } else if (ct === "application/json") {
      const json = JSON.stringify(req.body);
      proxyReq.setHeader("content-length", Buffer.byteLength(json));
      proxyReq.write(json);
    }
  }
  proxyReq.end();
});

export default router;
