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

    // Guest students with no registered user account, older than 24 hours,
    // and no currently-running lab session.
    // Skipping active sessions prevents a CASCADE from removing the DB row
    // while the Docker container is still live (which would orphan it).
    // CASCADE removes their lab_sessions and lab_progress automatically.
    await db.execute(sql`
      DELETE FROM students
      WHERE id NOT IN (SELECT id FROM "user")
        AND created_at < NOW() - INTERVAL '7 days'
        AND id NOT IN (
          SELECT student_id FROM lab_sessions WHERE status = 'running'
        )
    `);

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
