import { createHash } from "crypto";
import { Router, type Request, type Response, type NextFunction } from "express";
import { sql, eq, inArray } from "drizzle-orm";
import { fromNodeHeaders } from "better-auth/node";
import { db } from "@workspace/db";
import {
  passwordResetRequestsTable,
  registrationSettingsTable,
  registrationInvitesTable,
  registrationRequestsTable,
  remoteLabsTable,
  userTable,
  labRatingsTable,
  certRecordsTable,
  subscriptionsTable,
  planOverridesTable,
  type RegistrationRequestRow,
  type RemoteLabRow,
} from "@workspace/db/schema";
import { BUILTIN_LABS } from "../lib/labs/registry";
import { auth } from "../lib/auth";
import { stopSession } from "../lib/docker/manager";
import { logger } from "../lib/logger";

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

/** GET /admin/check — returns { isAdmin } without erroring for non-admins */
router.get("/check", async (req, res): Promise<void> => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  res.json({ isAdmin: !!(session?.user?.email && ADMIN_EMAILS.includes(session.user.email)) });
});

router.use(requireAdmin);

/**
 * GET /admin/lab-insights
 * Per-lab attempt/pass stats joined with difficulty ratings in one response.
 */
router.get("/lab-insights", async (_req, res): Promise<void> => {
  const result = await db.execute(sql`
    SELECT
      COALESCE(c.lab_id, r.lab_id)  AS lab_id,
      COALESCE(c.attempted, 0)::int  AS attempted,
      COALESCE(c.passed,    0)::int  AS passed,
      COALESCE(r.easy,      0)::int  AS easy,
      COALESCE(r.ok,        0)::int  AS ok,
      COALESCE(r.hard,      0)::int  AS hard,
      COALESCE(r.total,     0)::int  AS ratings
    FROM (
      SELECT lab_id,
        COUNT(*)::int                                   AS attempted,
        COUNT(*) FILTER (WHERE status = 'passed')::int  AS passed
      FROM lab_progress
      WHERE status != 'not_started'
        AND student_id IN (SELECT id FROM "user")
      GROUP BY lab_id
    ) c
    FULL OUTER JOIN (
      SELECT lab_id,
        COUNT(*) FILTER (WHERE rating = 'easy')::int AS easy,
        COUNT(*) FILTER (WHERE rating = 'ok')::int   AS ok,
        COUNT(*) FILTER (WHERE rating = 'hard')::int  AS hard,
        COUNT(*)::int                                  AS total
      FROM lab_ratings
      GROUP BY lab_id
    ) r ON c.lab_id = r.lab_id
    ORDER BY COALESCE(c.attempted, 0) DESC, COALESCE(r.total, 0) DESC
  `);
  res.json(result.rows);
});

/**
 * GET /admin/summary
 * Quick counts for the dashboard stat cards.
 */
router.get("/summary", async (_req, res): Promise<void> => {
  const result = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM lab_sessions WHERE status NOT IN ('stopped', 'error')) AS active_sessions,
      (SELECT COUNT(*) FROM registration_requests WHERE status = 'pending') AS pending_requests,
      (SELECT COUNT(*) FROM registration_invites WHERE used_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())) AS open_invites
  `);
  res.json(result.rows[0]);
});

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
      u.banned,
      s.created_at,
      COUNT(lp.id) FILTER (WHERE lp.status = 'passed')::int       AS passed,
      COUNT(lp.id) FILTER (WHERE lp.status != 'not_started')::int  AS attempted,
      MAX(lp.last_attempt_at)                                       AS last_active,
      COALESCE((
        SELECT SUM(EXTRACT(EPOCH FROM (
          CASE WHEN ls.status = 'running' THEN NOW() ELSE ls.updated_at END
          - ls.created_at
        )))::int
        FROM lab_sessions ls
        WHERE ls.student_id = s.id
          AND ls.status IN ('running', 'stopped')
      ), 0)                                                         AS total_time_seconds,
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
    GROUP BY s.id, u.name, u.email, u.banned, s.created_at
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
 * DELETE /admin/users/:userId
 * Permanently delete a student account and ALL associated data:
 *   - Stops any live Docker lab sessions first
 *   - password_reset_requests (no FK cascade, must be explicit)
 *   - students row (cascades → lab_sessions, lab_progress)
 *   - Better Auth user row (cascades → session, account, verification)
 */
router.delete("/users/:userId", async (req, res): Promise<void> => {
  const { userId } = req.params;
  if (!userId) {
    res.status(400).json({ error: "Missing userId" });
    return;
  }

  // Guard: never allow deleting an admin account.
  // Admin status is email-based (ADMIN_EMAILS env var); if the target user's
  // email is in that list, refuse — deleting their DB row would invalidate
  // their session and lock them out even though the env var still grants access.
  const targetUser = await db.execute(sql`SELECT email FROM "user" WHERE id = ${userId} LIMIT 1`);
  const targetEmail = (targetUser.rows[0] as Record<string, unknown> | undefined)?.email as string | undefined;
  if (targetEmail && ADMIN_EMAILS.includes(targetEmail)) {
    res.status(403).json({ error: "Cannot delete an admin account" });
    return;
  }

  // 1. Stop any live Docker containers for this student before touching the DB.
  //    We query first so we know exactly what to stop; errors here are logged but
  //    don't abort the delete — a dangling container is less bad than a dangling account.
  try {
    const activeSessions = await db.execute(sql`
      SELECT lab_id FROM lab_sessions
      WHERE student_id = ${userId} AND status NOT IN ('stopped', 'error')
    `);
    await Promise.allSettled(
      activeSessions.rows.map((row: Record<string, unknown>) =>
        stopSession(userId, row.lab_id as string)
      )
    );
  } catch (err) {
    // Non-fatal: log and continue with deletion.
    logger.error({ err }, "admin delete-user: failed to stop sessions");
  }

  // 2. Delete all data atomically.
  //    FK cascade handles: lab_sessions, lab_progress (via students), and
  //    session, account, verification (via user).  password_reset_requests
  //    has no FK so it must be deleted explicitly.
  //    Use db.transaction() — pg rejects multi-statement parameterised queries,
  //    so BEGIN/COMMIT in a single sql`` call would silently fail.
  await db.transaction(async (tx) => {
    await tx.execute(sql`DELETE FROM password_reset_requests WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM students WHERE id = ${userId}`);
    await tx.execute(sql`DELETE FROM "user" WHERE id = ${userId}`);
  });

  res.status(204).send();
});

/**
 * POST /admin/users/:userId/suspend
 * Soft-disable an account: sets banned=true, kills active lab containers,
 * and deletes all auth sessions (forces immediate sign-out).
 */
router.post("/users/:userId/suspend", async (req, res): Promise<void> => {
  const { userId } = req.params;

  const targetUser = await db.execute(sql`SELECT email FROM "user" WHERE id = ${userId} LIMIT 1`);
  const targetEmail = (targetUser.rows[0] as Record<string, unknown> | undefined)?.email as string | undefined;
  if (targetEmail && ADMIN_EMAILS.includes(targetEmail)) {
    res.status(403).json({ error: "Cannot suspend an admin account" });
    return;
  }

  // Kill live containers (non-fatal).
  try {
    const activeSessions = await db.execute(sql`
      SELECT lab_id FROM lab_sessions
      WHERE student_id = ${userId} AND status NOT IN ('stopped', 'error')
    `);
    await Promise.allSettled(
      activeSessions.rows.map((row: Record<string, unknown>) =>
        stopSession(userId, row.lab_id as string)
      )
    );
  } catch (err) {
    logger.error({ err }, "admin suspend: failed to stop sessions");
  }

  await db.execute(sql`UPDATE "user" SET banned = true  WHERE id = ${userId}`);
  await db.execute(sql`DELETE FROM session WHERE user_id = ${userId}`);

  res.json({ ok: true });
});

/**
 * POST /admin/users/:userId/unsuspend
 * Re-enable a suspended account.
 */
router.post("/users/:userId/unsuspend", async (req, res): Promise<void> => {
  const { userId } = req.params;
  await db.execute(sql`UPDATE "user" SET banned = false WHERE id = ${userId}`);
  res.json({ ok: true });
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
 * DELETE /admin/sessions/idle
 * Kill all sessions with no activity for >30 minutes.
 */
router.delete("/sessions/idle", async (_req, res): Promise<void> => {
  const result = await db.execute(sql`
    SELECT student_id, lab_id FROM lab_sessions
    WHERE status NOT IN ('stopped', 'error')
      AND updated_at < NOW() - interval '30 minutes'
  `);
  await Promise.allSettled(
    result.rows.map((r: Record<string, unknown>) =>
      stopSession(r.student_id as string, r.lab_id as string)
    )
  );
  res.json({ killed: result.rows.length });
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

// ── Registration control ──────────────────────────────────────────────────────

router.get("/registration", async (_req, res): Promise<void> => {
  const rows = await db.select().from(registrationSettingsTable).limit(1);
  res.json(rows[0] ?? { id: 1, mode: "open" });
});

router.put("/registration", async (req, res): Promise<void> => {
  const { mode } = req.body ?? {};
  if (!["open", "invite_only", "invite_or_request"].includes(mode)) {
    res.status(400).json({ error: "Invalid mode" });
    return;
  }
  await db
    .insert(registrationSettingsTable)
    .values({ id: 1, mode })
    .onConflictDoUpdate({ target: registrationSettingsTable.id, set: { mode } });
  res.json({ ok: true, mode });
});

router.get("/registration/invites", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(registrationInvitesTable)
    .orderBy(registrationInvitesTable.createdAt);
  res.json(rows);
});

router.post("/registration/invites", async (req, res): Promise<void> => {
  const { email } = req.body ?? {};
  if (!email) { res.status(400).json({ error: "email required" }); return; }
  const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  await db
    .insert(registrationInvitesTable)
    .values({
      email: String(email).toLowerCase().trim(),
      expiresAt,
    })
    .onConflictDoNothing();
  res.status(201).json({ ok: true });
});

/** DELETE /admin/registration/invites/expired — remove all expired unused invites */
router.delete("/registration/invites/expired", async (_req, res): Promise<void> => {
  const result = await db.execute(sql`
    DELETE FROM registration_invites
    WHERE expires_at IS NOT NULL AND expires_at < NOW() AND used_at IS NULL
    RETURNING id
  `);
  res.json({ deleted: result.rows.length });
});

router.delete("/registration/invites/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(registrationInvitesTable).where(eq(registrationInvitesTable.id, id));
  res.status(204).send();
});

router.get("/registration/requests", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(registrationRequestsTable)
    .orderBy(registrationRequestsTable.createdAt);
  res.json(rows);
});

router.post("/registration/requests/:id/approve", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db
    .select()
    .from(registrationRequestsTable)
    .where(eq(registrationRequestsTable.id, id))
    .limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await db
    .insert(registrationInvitesTable)
    .values({ email: row.email })
    .onConflictDoNothing();
  await db
    .update(registrationRequestsTable)
    .set({ status: "approved" })
    .where(eq(registrationRequestsTable.id, id));
  res.json({ ok: true });
});

router.delete("/registration/requests/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(registrationRequestsTable).where(eq(registrationRequestsTable.id, id));
  res.status(204).send();
});

/** POST /admin/registration/requests/bulk-approve — approve multiple pending requests at once */
router.post("/registration/requests/bulk-approve", async (req, res): Promise<void> => {
  const ids: unknown = req.body?.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids must be a non-empty array" }); return;
  }
  const parsed = ids.map((id) => parseInt(id as string, 10)).filter((n) => !isNaN(n));
  if (parsed.length === 0) { res.status(400).json({ error: "No valid ids" }); return; }

  const rows = await db
    .select()
    .from(registrationRequestsTable)
    .where(inArray(registrationRequestsTable.id, parsed));
  const pending = (rows as RegistrationRequestRow[]).filter((r) => r.status === "pending");
  if (pending.length === 0) { res.json({ approved: 0 }); return; }

  await db
    .insert(registrationInvitesTable)
    .values(pending.map((r) => ({ email: r.email })))
    .onConflictDoNothing();
  await db
    .update(registrationRequestsTable)
    .set({ status: "approved" })
    .where(inArray(registrationRequestsTable.id, pending.map((r) => r.id)));
  res.json({ approved: pending.length });
});

/**
 * GET /admin/labs — all labs (built-in + remote) with active flag.
 * Unlike the student-facing endpoint, this returns ALL remote labs regardless
 * of their active status so admins can see and toggle disabled labs.
 * Built-in labs that are overridden by a remote entry appear as remote.
 */
router.get("/labs", async (_req, res): Promise<void> => {
  // Fetch every remote row — no active filter, so admins can see hidden labs.
  const allRemote = (await db
    .select({ id: remoteLabsTable.id, definition: remoteLabsTable.definition, active: remoteLabsTable.active })
    .from(remoteLabsTable)) as Pick<RemoteLabRow, "id" | "definition" | "active">[];

  const remoteIdSet = new Set(allRemote.map((r) => r.id));

  // Builtins that have no remote counterpart — always active, not toggleable.
  const builtinEntries = BUILTIN_LABS
    .filter((l) => !remoteIdSet.has(l.id))
    .map((l) => ({ id: l.id, title: l.title, track: l.track, level: l.level ?? null, order: l.order, isRemote: false, active: true }));

  // All remote labs (active + inactive) — include overrides of builtins.
  const remoteEntries = allRemote.map((r) => {
    const def = r.definition as Record<string, unknown>;
    return {
      id: r.id,
      title: String(def.title ?? r.id),
      track: String(def.track ?? ""),
      level: (def.level as number | null) ?? null,
      order: Number(def.order ?? 0),
      isRemote: true,
      active: r.active,
    };
  });

  res.json([...builtinEntries, ...remoteEntries].sort((a, b) => a.order - b.order));
});

/** PUT /admin/labs/:labId/active — enable or disable a remote lab */
router.put("/labs/:labId/active", async (req, res): Promise<void> => {
  const { labId } = req.params;
  const { active } = req.body ?? {};
  if (typeof active !== "boolean") { res.status(400).json({ error: "active must be a boolean" }); return; }
  const result = await db
    .update(remoteLabsTable)
    .set({ active })
    .where(eq(remoteLabsTable.id, labId))
    .returning({ id: remoteLabsTable.id });
  if (result.length === 0) { res.status(404).json({ error: "Lab not found or not a remote lab" }); return; }
  res.json({ ok: true, id: labId, active });
});

/**
 * GET /admin/registration/audit
 * Chronological list of registration events (invites, registrations, requests).
 */
router.get("/registration/audit", async (_req, res): Promise<void> => {
  const result = await db.execute(sql`
    SELECT 'invited'    AS event, email, NULL::text AS name, created_at AS at FROM registration_invites
    UNION ALL
    SELECT 'registered',          email, NULL,               used_at         FROM registration_invites WHERE used_at IS NOT NULL
    UNION ALL
    SELECT status,                email, name,               created_at      FROM registration_requests
    ORDER BY at DESC
    LIMIT 200
  `);
  res.json(result.rows);
});

/**
 * POST /admin/certs/backfill
 * Generates and upserts cert_records for every student who completed a track
 * or level but never visited the certificate page (so no record was written).
 * Safe to run multiple times — uses upsert on certId PK.
 */
router.post("/certs/backfill", async (req, res): Promise<void> => {
  const dryRun = req.query.dryRun === "true";
  function makeCertId(studentId: string, track: string, level?: number | null): string {
    const key = level != null ? `${studentId}:${track}:level:${level}` : `${studentId}:${track}`;
    return createHash("sha256").update(key).digest("hex").slice(0, 16).toUpperCase();
  }

  // Find students who passed every lab in a track (track cert, no level param)
  // and students who passed every lab at a specific level (level cert).
  // remote_labs stores the full LabDefinition as JSONB.
  const rows = await db.execute(sql`
    WITH lab_meta AS (
      SELECT
        definition->>'id'    AS lab_id,
        definition->>'track' AS track,
        (definition->>'level')::int AS level
      FROM remote_labs
    ),
    -- track certs: student passed ALL labs in the track regardless of level
    track_totals AS (
      SELECT track, COUNT(*) AS total FROM lab_meta GROUP BY track
    ),
    track_earned AS (
      SELECT lp.student_id, lm.track, NULL::int AS level,
             COUNT(*) FILTER (WHERE lp.status = 'passed') AS passed,
             MAX(lp.last_attempt_at) FILTER (WHERE lp.status = 'passed') AS earned_at
      FROM lab_progress lp
      JOIN lab_meta lm ON lm.lab_id = lp.lab_id
      GROUP BY lp.student_id, lm.track
    ),
    track_complete AS (
      SELECT te.student_id, te.track, te.level, te.earned_at
      FROM track_earned te
      JOIN track_totals tt ON tt.track = te.track
      WHERE te.passed >= tt.total
    ),
    -- level certs: student passed ALL labs at a specific level within a track
    level_totals AS (
      SELECT track, level, COUNT(*) AS total FROM lab_meta WHERE level IS NOT NULL GROUP BY track, level
    ),
    level_earned AS (
      SELECT lp.student_id, lm.track, lm.level,
             COUNT(*) FILTER (WHERE lp.status = 'passed') AS passed,
             MAX(lp.last_attempt_at) FILTER (WHERE lp.status = 'passed') AS earned_at
      FROM lab_progress lp
      JOIN lab_meta lm ON lm.lab_id = lp.lab_id AND lm.level IS NOT NULL
      GROUP BY lp.student_id, lm.track, lm.level
    ),
    level_complete AS (
      SELECT le.student_id, le.track, le.level, le.earned_at
      FROM level_earned le
      JOIN level_totals lt ON lt.track = le.track AND lt.level = le.level
      WHERE le.passed >= lt.total
    ),
    all_complete AS (
      SELECT * FROM track_complete
      UNION ALL
      SELECT * FROM level_complete
    )
    SELECT
      ac.student_id,
      ac.track,
      ac.level,
      ac.earned_at,
      COALESCE(u.name, split_part(u.email, '@', 1), 'Student') AS student_name
    FROM all_complete ac
    LEFT JOIN "user" u ON u.id = ac.student_id
    WHERE ac.earned_at IS NOT NULL
  `);

  type Row = { student_id: string; track: string; level: number | null; earned_at: Date; student_name: string };
  const records = (rows.rows as Row[]).map(r => ({
    certId: makeCertId(r.student_id, r.track, r.level),
    studentName: r.student_name,
    track: r.track,
    level: r.level,
    earnedAt: new Date(r.earned_at),
  }));

  if (records.length === 0) { res.json({ upserted: 0, dryRun }); return; }

  if (dryRun) {
    res.json({ upserted: records.length, dryRun: true, records });
    return;
  }

  await db.insert(certRecordsTable)
    .values(records)
    .onConflictDoUpdate({
      target: certRecordsTable.certId,
      set: { studentName: sql`excluded.student_name`, earnedAt: sql`excluded.earned_at` },
    });

  res.json({ upserted: records.length, dryRun: false });
});

// ── Billing / subscriptions ───────────────────────────────────────────────────

/** GET /admin/subscriptions — all subscribers with user info */
router.get("/subscriptions", async (_req, res): Promise<void> => {
  const rows = await db.execute(sql`
    SELECT
      s.user_id, s.plan, s.status, s.started_at, s.renews_at, s.provider_ref, s.updated_at,
      u.name, u.email,
      o.plan AS override_plan, o.expires_at AS override_expires
    FROM subscriptions s
    JOIN "user" u ON u.id = s.user_id
    LEFT JOIN plan_overrides o ON o.user_id = s.user_id
    ORDER BY s.updated_at DESC
  `);
  res.json(rows.rows);
});

/** PATCH /admin/subscriptions/:userId — change plan/status */
router.patch("/subscriptions/:userId", async (req, res): Promise<void> => {
  const { userId } = req.params;
  const { plan, status } = req.body ?? {};
  if (!plan && !status) { res.status(400).json({ error: "plan or status required" }); return; }
  await db.execute(sql`
    INSERT INTO subscriptions (user_id, plan, status)
    VALUES (${userId}, ${plan ?? "linux-starter"}, ${status ?? "active"})
    ON CONFLICT (user_id) DO UPDATE SET
      plan = COALESCE(${plan ?? null}, subscriptions.plan),
      status = COALESCE(${status ?? null}, subscriptions.status),
      updated_at = NOW()
  `);
  res.json({ ok: true });
});

/** POST /admin/subscriptions/:userId/override — grant free plan override */
router.post("/subscriptions/:userId/override", async (req, res): Promise<void> => {
  const { userId } = req.params;
  const { plan, expiresAt } = req.body ?? {};
  if (!plan) { res.status(400).json({ error: "plan required" }); return; }
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  await db.execute(sql`
    INSERT INTO plan_overrides (user_id, plan, granted_by, expires_at)
    VALUES (${userId}, ${plan}, ${session!.user.email}, ${expiresAt ?? null})
    ON CONFLICT (user_id) DO UPDATE SET
      plan = ${plan}, granted_by = ${session!.user.email},
      expires_at = ${expiresAt ?? null}, created_at = NOW()
  `);
  res.json({ ok: true });
});

/** DELETE /admin/subscriptions/:userId/override — remove override */
router.delete("/subscriptions/:userId/override", async (req, res): Promise<void> => {
  await db.execute(sql`DELETE FROM plan_overrides WHERE user_id = ${req.params.userId}`);
  res.json({ ok: true });
});

/** GET /admin/revenue — MRR + subscriber counts + churn */
router.get("/revenue", async (_req, res): Promise<void> => {
  const rows = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'active')::int                        AS active_total,
      COUNT(*) FILTER (WHERE status = 'active' AND plan = 'linux-starter')::int AS starter_active,
      COUNT(*) FILTER (WHERE status = 'active' AND plan = 'devops-pro')::int    AS pro_active,
      COUNT(*) FILTER (WHERE status = 'cancelled'
        AND updated_at > NOW() - interval '30 days')::int                   AS churned_30d
    FROM subscriptions
  `);
  res.json(rows.rows[0]);
});

export default router;
