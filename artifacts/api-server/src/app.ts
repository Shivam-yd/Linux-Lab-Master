import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
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

// Better Auth handles /api/auth/* — must be registered before body parsers
// so it can consume the raw request body itself.
// Use app.use (not app.all) because Express 5 requires named wildcard params.
app.use("/api/auth", toNodeHandler(auth));

app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser(sessionSecret));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
