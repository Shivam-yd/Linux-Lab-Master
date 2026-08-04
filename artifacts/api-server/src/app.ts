import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { rateLimit } from "express-rate-limit";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const sessionSecret = process.env.SESSION_SECRET ?? "changeme-set-SESSION_SECRET-in-production";
if (!process.env.SESSION_SECRET) {
  console.warn(
    "[warn] SESSION_SECRET is not set — using an insecure default. " +
    "Set SESSION_SECRET to a long random string in production.",
  );
}

// CORS must be registered FIRST so every response (including auth) carries
// the correct Access-Control-Allow-* headers and Set-Cookie is honoured.
app.use(cors({ credentials: true, origin: true }));

// Trust the first proxy hop (Replit's reverse proxy sends X-Forwarded-For).
// Required for express-rate-limit to identify clients correctly.
app.set("trust proxy", 1);

// Rate-limit auth endpoints to blunt brute-force attacks.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 500, standardHeaders: true, legacyHeaders: false });

// Better Auth handles /api/auth/* — must be registered before body parsers
// so it can consume the raw request body itself.
// Use app.use (not app.all) because Express 5 requires named wildcard params.
app.use("/api/auth", authLimiter, toNodeHandler(auth));
app.use(cookieParser(sessionSecret));
const captureRawBody = (req: Request, _res: Response, buf: Buffer): void => {
  (req as Request & { rawBody?: string }).rawBody = buf.toString("utf8");
};
app.use(express.json({ verify: captureRawBody }));
// Capture raw body alongside parsed body so the UI proxy can forward
// form POSTs byte-for-byte without re-encoding (which drops repeated keys).
app.use(express.urlencoded({
  extended: true,
  verify: captureRawBody,
}));
// Jenkins' dynamic configuration widgets use this custom content type and
// send a JSON method-invocation body. Capture it without trying to parse it.
app.use(express.raw({
  type: "application/x-stapler-method-invocation",
  verify: captureRawBody,
}));

app.use("/api", router);

// Global error handler — must be the last middleware (4 args tells Express it's an error handler).
// Catches any unhandled error from async route handlers and returns JSON instead of Express's
// default HTML 500, so API clients always get a machine-readable response.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
