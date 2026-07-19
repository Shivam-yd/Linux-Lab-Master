import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";
import { stopExpiredSessions } from "./docker/manager";

async function runCleanup(): Promise<void> {
  try {
    // Kill containers that have been running > 1 hour (recovers from server restarts).
    await stopExpiredSessions();

    // Lab sync log: keep only last 24 hours.
    await db.execute(sql`DELETE FROM lab_sync_log WHERE synced_at < NOW() - INTERVAL '24 hours'`);

    // Guest students with no registered user account, older than 24 hours.
    // CASCADE removes their lab_sessions and lab_progress automatically.
    await db.execute(sql`
      DELETE FROM students
      WHERE id NOT IN (SELECT id FROM "user")
        AND created_at < NOW() - INTERVAL '24 hours'
    `);

    // Used or expired password reset requests.
    await db.execute(sql`
      DELETE FROM password_reset_requests
      WHERE status = 'used'
         OR (expires_at IS NOT NULL AND expires_at < NOW())
    `);

    // Better Auth: expired sessions and verifications.
    await db.execute(sql`DELETE FROM session      WHERE expires_at < NOW()`);
    await db.execute(sql`DELETE FROM verification WHERE expires_at < NOW()`);

    logger.info("cleanup: pass complete");
  } catch (err) {
    logger.error({ err }, "cleanup: pass failed");
  }
}

export function startCleanupJob(): void {
  // First pass 30 s after boot so stale data from the previous run is flushed quickly.
  setTimeout(() => void runCleanup(), 30_000);
  // Then every hour.
  setInterval(() => void runCleanup(), 60 * 60 * 1_000);
}
