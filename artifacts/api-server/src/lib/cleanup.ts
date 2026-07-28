import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";
import { stopExpiredSessions } from "./docker/manager";

let _running = false;

async function runCleanup(): Promise<void> {
  if (_running) return;
  _running = true;
  try {
    // Kill containers that have been running > 1 hour (recovers from server restarts).
    await stopExpiredSessions();

    // Lab sync log: keep only last 24 hours.
    await db.execute(sql`DELETE FROM lab_sync_log WHERE synced_at < NOW() - INTERVAL '24 hours'`);

    // Used or expired password reset requests.
    // Also prune pending requests older than 30 days (admin never acted on them).
    await db.execute(sql`
      DELETE FROM password_reset_requests
      WHERE status = 'used'
         OR (expires_at IS NOT NULL AND expires_at < NOW())
         OR (status = 'pending' AND requested_at < NOW() - INTERVAL '30 days')
    `);

    // Better Auth: expired sessions and verifications.
    await db.execute(sql`DELETE FROM session      WHERE expires_at < NOW()`);
    await db.execute(sql`DELETE FROM verification WHERE expires_at < NOW()`);

    logger.info("cleanup: pass complete");
  } catch (err) {
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
