import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { toNodeHandler } from "better-auth/node";
import { eq } from "drizzle-orm";
import { auth } from "./lib/auth";
import { db } from "@workspace/db";
import { userTable } from "@workspace/db/schema";
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

// Ban pre-check: intercept email sign-in before Better Auth so we can return
// a clean 403 instead of letting the session hook produce a noisy 500.
app.post("/api/auth/sign-in/email", (req: Request, res: Response, next: NextFunction) => {
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", async () => {
    const rawBody = Buffer.concat(chunks);
    try {
      const { email } = JSON.parse(rawBody.toString()) as { email?: string };
      if (email) {
        const rows = await db
          .select({ banned: userTable.banned })
          .from(userTable)
          .where(eq(userTable.email, email.toLowerCase()))
          .limit(1);
        if (rows[0]?.banned) {
          res.status(403).json({ error: "Your account has been suspended. Contact your instructor." });
          return;
        }
      }
    } catch { /* ignore parse errors — let Better Auth handle the malformed request */ }
    // Push body back so Better Auth can consume it normally.
    req.unshift(rawBody);
    next();
  });
});

// Better Auth handles /api/auth/* — must be registered before body parsers
// so it can consume the raw request body itself.
// Use app.use (not app.all) because Express 5 requires named wildcard params.
app.use("/api/auth", toNodeHandler(auth));
app.use(cookieParser(sessionSecret));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
