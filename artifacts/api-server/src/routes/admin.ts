import { Router, type Request, type Response, type NextFunction } from "express";
import { sql } from "drizzle-orm";
import { fromNodeHeaders } from "better-auth/node";
import { db } from "@workspace/db";
import { auth } from "../lib/auth";

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
router.get("/admin/leaderboard", async (_req, res): Promise<void> => {
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
    LEFT JOIN lab_progress lp ON lp.student_id = s.id
    LEFT JOIN "user" u ON u.id = s.id
    GROUP BY s.id, u.name, u.email, s.created_at
    ORDER BY passed DESC, attempted DESC, s.created_at DESC
  `);
  res.json(result.rows);
});

/**
 * GET /admin/cohort
 * Per-lab attempt and pass counts across all students.
 */
router.get("/admin/cohort", async (_req, res): Promise<void> => {
  const result = await db.execute(sql`
    SELECT
      lab_id,
      COUNT(*)::int                                    AS attempted,
      COUNT(*) FILTER (WHERE status = 'passed')::int  AS passed
    FROM lab_progress
    WHERE status != 'not_started'
    GROUP BY lab_id
    ORDER BY attempted DESC, passed DESC
  `);
  res.json(result.rows);
});

export default router;
