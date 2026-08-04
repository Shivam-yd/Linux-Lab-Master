import { db } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";
import { stopExpiredSessions } from "./docker/manager";
import { cleanupRunsTable } from "@workspace/db/schema";
import { recordErrorEvent } from "./operations";

let _running = false;

async function runCleanup(): Promise<void> {
  if (_running) return;
  _running = true;
  const startedAt = new Date();
  let runId: number | null = null;
  try {
    const [run] = await db.insert(cleanupRunsTable).values({ status: "running", startedAt }).returning({ id: cleanupRunsTable.id });
    runId = run.id;

    // Kill containers that have been running > 1 hour (recovers from server restarts).
    const stoppedSessions = await stopExpiredSessions();

    // Lab sync log: keep only last 24 hours.
    const syncDeleted = await db.execute(sql`DELETE FROM lab_sync_log WHERE synced_at < NOW() - INTERVAL '24 hours'`);

    // Used or expired password reset requests.
    // Also prune pending requests older than 30 days (admin never acted on them).
    const resetDeleted = await db.execute(sql`
      DELETE FROM password_reset_requests
      WHERE status = 'used'
         OR (expires_at IS NOT NULL AND expires_at < NOW())
         OR (status = 'pending' AND requested_at < NOW() - INTERVAL '30 days')
    `);

    // Better Auth: expired sessions and verifications.
    const sessionDeleted = await db.execute(sql`DELETE FROM session WHERE expires_at < NOW()`);
    const verificationDeleted = await db.execute(sql`DELETE FROM verification WHERE expires_at < NOW()`);
    const telemetryDeleted = await db.execute(sql`
      DELETE FROM error_events
      WHERE created_at < NOW() - INTERVAL '30 days'
    `);
    const auditDeleted = await db.execute(sql`
      DELETE FROM admin_audit_log
      WHERE created_at < NOW() - INTERVAL '90 days'
    `);
    const deletedRows = Number(syncDeleted.rowCount ?? 0) + Number(resetDeleted.rowCount ?? 0)
      + Number(sessionDeleted.rowCount ?? 0) + Number(verificationDeleted.rowCount ?? 0)
      + Number(telemetryDeleted.rowCount ?? 0) + Number(auditDeleted.rowCount ?? 0);
    await db.update(cleanupRunsTable).set({
      status: "success",
      deletedRows,
      stoppedSessions,
      completedAt: new Date(),
    }).where(eq(cleanupRunsTable.id, runId!));

    logger.info({ deletedRows, stoppedSessions }, "cleanup: pass complete");
  } catch (err) {
    if (runId !== null) {
      await db.update(cleanupRunsTable).set({
        status: "error",
        errorMessage: err instanceof Error ? err.message.slice(0, 1000) : String(err).slice(0, 1000),
        completedAt: new Date(),
      }).where(eq(cleanupRunsTable.id, runId)).catch(() => {});
    }
    await recordErrorEvent({ source: "cleanup", error: err });
    logger.error({ err }, "cleanup: pass failed");
  } finally {
    _running = false;
  }
}

export function startCleanupJob(): void {
  // First pass 30 s after boot so stale data from the previous run is flushed quickly.
  setTimeout(() => void runCleanup(), 30_000);
  // Then every hour.
  setInterval(() => void runCleanup(), 60 * 60 * 1_000);
}
