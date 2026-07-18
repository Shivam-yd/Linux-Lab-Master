import { Router, type Request, type Response, type NextFunction } from "express";
import { sql, eq, or } from "drizzle-orm";
import { fromNodeHeaders } from "better-auth/node";
import { db } from "@workspace/db";
import { passwordResetRequestsTable } from "@workspace/db/schema";
import { auth } from "../lib/auth";
import { stopSession } from "../lib/docker/manager";

// Comma-separated list of admin emails set via the ADMIN_EMAILS env var.
// e.g. ADMIN_EMAILS=alice@example.com,bob@example.com
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

const router = Router();
router.use(requireAdmin);

/**
 * GET /admin/leaderboard
 * All students ranked by passed lab count.
 * Includes name/email for Better Auth users, null for guests.
 */
router.get("/leaderboard", async (_req, res): Promise<void> => {
  const result = await db.execute(sql`
    SELECT
      s.id,
      u.name,
      u.email,
      s.created_at,
      COUNT(lp.id) FILTER (WHERE lp.status = 'passed')::int       AS passed,
      COUNT(lp.id) FILTER (WHERE lp.status != 'not_started')::int  AS attempted,
      MAX(lp.last_attempt_at)                                       AS last_active,
      COALESCE(
        json_agg(
          json_build_object(
            'labId',     lp.lab_id,
            'status',    lp.status,
            'bestScore', lp.best_score
          ) ORDER BY lp.lab_id
        ) FILTER (WHERE lp.id IS NOT NULL),
        '[]'::json
      ) AS labs
    FROM students s
    INNER JOIN "user" u ON u.id = s.id
    LEFT JOIN lab_progress lp ON lp.student_id = s.id
    GROUP BY s.id, u.name, u.email, s.created_at
    ORDER BY passed DESC, attempted DESC, s.created_at DESC
  `);
  res.json(result.rows);
});

/**
 * GET /admin/cohort
 * Per-lab attempt and pass counts across all students.
 */
router.get("/cohort", async (_req, res): Promise<void> => {
  const result = await db.execute(sql`
    SELECT
      lab_id,
      COUNT(*)::int                                    AS attempted,
      COUNT(*) FILTER (WHERE status = 'passed')::int  AS passed
    FROM lab_progress
    WHERE status != 'not_started'
      AND student_id IN (SELECT id FROM "user")
    GROUP BY lab_id
    ORDER BY attempted DESC, passed DESC
  `);
  res.json(result.rows);
});

/**
 * DELETE /admin/progress/:studentId
 * Wipe all lab_progress rows for a student (resets their progress to not_started).
 */
router.delete("/progress/:studentId", async (req, res): Promise<void> => {
  const { studentId } = req.params;
  if (!studentId) {
    res.status(400).json({ error: "Missing studentId" });
    return;
  }
  await db.execute(sql`DELETE FROM lab_progress WHERE student_id = ${studentId}`);
  res.status(204).send();
});

/**
 * GET /admin/sessions
 * All non-stopped lab sessions with student info.
 */
router.get("/sessions", async (_req, res): Promise<void> => {
  const result = await db.execute(sql`
    SELECT
      ls.student_id,
      ls.lab_id,
      ls.status,
      ls.container_id,
      ls.updated_at,
      u.name,
      u.email
    FROM lab_sessions ls
    LEFT JOIN "user" u ON u.id = ls.student_id
    WHERE ls.status NOT IN ('stopped')
    ORDER BY ls.updated_at DESC
  `);
  res.json(result.rows);
});

/**
 * DELETE /admin/sessions/:studentId/:labId
 * Force-kill a specific lab session.
 */
router.delete("/sessions/:studentId/:labId", async (req, res): Promise<void> => {
  const { studentId, labId } = req.params;
  if (!studentId || !labId) {
    res.status(400).json({ error: "Missing studentId or labId" });
    return;
  }
  await stopSession(studentId, labId);
  res.status(204).send();
});

/**
 * GET /admin/password-reset-requests
 * List all pending (and recently approved) password reset requests.
 */
router.get("/password-reset-requests", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(passwordResetRequestsTable)
    .orderBy(passwordResetRequestsTable.requestedAt);
  res.json(rows);
});

/**
 * POST /admin/password-reset-requests/:id/approve
 * Approve a pending request: triggers Better Auth to generate a reset token,
 * which the sendResetPassword hook captures and stores on the row.
 */
router.post("/password-reset-requests/:id/approve", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await db
    .select()
    .from(passwordResetRequestsTable)
    .where(eq(passwordResetRequestsTable.id, id))
    .limit(1);

  if (rows.length === 0) { res.status(404).json({ error: "Not found" }); return; }

  // Allow re-approval of already-approved rows (e.g. token expired before student used it).
  // Reject only "used" rows — those are finished.
  if (rows[0].status === "used") {
    res.status(400).json({ error: "Request has already been used" }); return;
  }

  const baseURL =
    process.env.BETTER_AUTH_URL ??
    (process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "http://localhost:8080");

  // Trigger Better Auth to generate a reset token; the sendResetPassword hook
  // will store the token on the row and flip status → approved.
  await auth.api.requestPasswordReset({
    body: { email: rows[0].email, redirectTo: `${baseURL}/reset-password` },
  });

  // Verify the hook actually ran — it stores the token and flips status to "approved".
  // If the row is still "pending" the hook silently failed.
  const [updated] = await db
    .select({ status: passwordResetRequestsTable.status })
    .from(passwordResetRequestsTable)
    .where(eq(passwordResetRequestsTable.id, id))
    .limit(1);

  if (!updated || updated.status !== "approved") {
    res.status(500).json({ error: "Approval failed — token could not be generated" }); return;
  }

  res.json({ ok: true });
});

/**
 * DELETE /admin/password-reset-requests/:id
 * Dismiss / delete a password reset request (any status).
 */
router.delete("/password-reset-requests/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db
    .delete(passwordResetRequestsTable)
    .where(eq(passwordResetRequestsTable.id, id));
  res.status(204).send();
});

export default router;
