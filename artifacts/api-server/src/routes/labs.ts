import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { labProgressTable, labRatingsTable } from "@workspace/db/schema";
import {
  ListLabsResponse,
  GetLabParams,
  GetLabResponse,
  ListProgressResponse,
} from "@workspace/api-zod";
import { getAllLabs, getLabByIdAsync } from "../lib/labs/registry";
import { runSync, getLastSyncStatus } from "../lib/github-sync";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

router.use(requireAuth);

// ── Lab listing ───────────────────────────────────────────────────────────────

router.get("/labs", async (_req, res): Promise<void> => {
  const all = await getAllLabs();
  const labs = all.map((lab) => ({
    id: lab.id,
    title: lab.title,
    track: lab.track,
    level: lab.level,
    category: lab.category,
    difficulty: lab.difficulty,
    summary: lab.summary,
    estimatedMinutes: lab.estimatedMinutes,
    order: lab.order,
  }));
  res.json(ListLabsResponse.parse(labs));
});

// ── GitHub sync ───────────────────────────────────────────────────────────────
// Must be registered BEFORE /labs/:labId — otherwise Express matches "sync"
// as a labId param and the sync routes always return 404.

/** GET /labs/sync/status — last sync info + total remote lab count */
router.get("/labs/sync/status", async (_req, res): Promise<void> => {
  try {
    const status = await getLastSyncStatus();
    res.json(status);
  } catch {
    res.status(500).json({ error: "Failed to get sync status" });
  }
});

/** POST /labs/sync — trigger an immediate sync from GitHub */
router.post("/labs/sync", async (_req, res): Promise<void> => {
  try {
    const result = await runSync("manual");
    if (result.status === "error") { res.status(502).json(result); return; }
    if (result.status === "skipped") { res.status(202).json(result); return; }
    res.json(result);
  } catch {
    res.status(500).json({ error: "Sync failed unexpectedly" });
  }
});

router.get("/labs/:labId", async (req, res): Promise<void> => {
  const params = GetLabParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const lab = await getLabByIdAsync(params.data.labId);
  if (!lab) {
    res.status(404).json({ error: "Lab not found" });
    return;
  }
  res.json(
    GetLabResponse.parse({
      id: lab.id,
      title: lab.title,
      track: lab.track,
      level: lab.level,
      category: lab.category,
      difficulty: lab.difficulty,
      summary: lab.summary,
      estimatedMinutes: lab.estimatedMinutes,
      order: lab.order,
      instructions: lab.instructions,
      objectives: lab.objectives,
      tasks: lab.tasks,
      terminals: lab.terminals.map((t) => t.name),
    }),
  );
});

// ── Student progress ──────────────────────────────────────────────────────────

router.get("/progress", async (req, res): Promise<void> => {
  const all = await getAllLabs();
  const rows = await db
    .select()
    .from(labProgressTable)
    .where(eq(labProgressTable.studentId, req.studentId));

  type ProgressRow = {
    labId: string; status: string; bestScore: number;
    lastAttemptAt: Date | null; lastResults: unknown;
  };
  const byLabId = new Map((rows as ProgressRow[]).map((r) => [r.labId, r]));
  const progress = all.map((lab) => {
    const row = byLabId.get(lab.id);
    return {
      labId: lab.id,
      status: row?.status ?? "not_started",
      bestScore: row?.bestScore ?? 0,
      lastAttemptAt: row?.lastAttemptAt ?? null,
      lastResults: (row?.lastResults as any[] | null) ?? null,
    };
  });
  res.json(ListProgressResponse.parse(progress));
});

router.get("/rank", async (req, res): Promise<void> => {
  const result = await db.execute(sql`
    WITH ranked AS (
      SELECT student_id,
             RANK() OVER (ORDER BY COUNT(*) FILTER (WHERE status = 'passed') DESC) AS rank
      FROM lab_progress
      GROUP BY student_id
    )
    SELECT
      COALESCE((SELECT rank FROM ranked WHERE student_id = ${req.studentId}), NULL) AS rank,
      (SELECT COUNT(DISTINCT id) FROM students)::int AS total
  `);
  const row = result.rows[0] as { rank: string | null; total: number };
  res.json({ rank: row.rank ? Number(row.rank) : null, total: row.total });
});


/** POST /labs/:labId/rating — student submits easy/ok/hard after passing */
router.post("/labs/:labId/rating", async (req, res): Promise<void> => {
  const { rating } = req.body;
  if (!["easy", "ok", "hard"].includes(rating)) { res.status(400).json({ error: "Invalid rating" }); return; }
  await db.insert(labRatingsTable)
    .values({ studentId: req.studentId, labId: req.params.labId, rating })
    .onConflictDoUpdate({ target: [labRatingsTable.studentId, labRatingsTable.labId], set: { rating } });
  res.json({ ok: true });
});

/** GET /labs/:labId/rating — counts + this student's own pick */
router.get("/labs/:labId/rating", async (req, res): Promise<void> => {
  const rows = await db.select({ studentId: labRatingsTable.studentId, rating: labRatingsTable.rating })
    .from(labRatingsTable).where(eq(labRatingsTable.labId, req.params.labId));
  const counts = { easy: 0, ok: 0, hard: 0 };
  for (const r of rows) counts[r.rating as keyof typeof counts]++;
  const mine = rows.find(r => r.studentId === req.studentId)?.rating ?? null;
  res.json({ counts, mine });
});

export default router;
