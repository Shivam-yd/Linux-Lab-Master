import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { docker } from "../lib/docker/manager";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/health", async (_req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    const schemaResult = await db.execute(sql`
      SELECT
        to_regclass('public.admin_audit_log') IS NOT NULL AS audit_log,
        to_regclass('public.cleanup_runs') IS NOT NULL AS cleanup_runs,
        to_regclass('public.error_events') IS NOT NULL AS error_events,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'cert_records'
            AND column_name = 'show_name'
        ) AS certificate_privacy
    `);
    const schema = schemaResult.rows[0] as {
      audit_log: boolean
      cleanup_runs: boolean
      error_events: boolean
      certificate_privacy: boolean
    };
    const schemaOk = Object.values(schema).every(Boolean);
    const dockerOk = await docker.ping().then(() => true).catch(() => false);
    const ok = dockerOk && schemaOk;
    res.status(ok ? 200 : 503).json({
      ok,
      db: "ok",
      docker: dockerOk ? "ok" : "error",
      schema: schemaOk ? "ok" : "error",
    });
  } catch {
    res.status(503).json({ ok: false, db: "error", docker: "unknown", schema: "unknown" });
  }
});

export default router;
