import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { labProgressTable } from "@workspace/db/schema";
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

  const byLabId = new Map(rows.map((r) => [r.labId, r]));
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

// ── GitHub sync ───────────────────────────────────────────────────────────────

/** GET /labs/sync/status — last sync info + total remote lab count */
router.get("/labs/sync/status", async (_req, res): Promise<void> => {
  try {
    const status = await getLastSyncStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: "Failed to get sync status" });
  }
});

/** POST /labs/sync — trigger an immediate sync from GitHub */
router.post("/labs/sync", async (_req, res): Promise<void> => {
  try {
    const result = await runSync("manual");
    // Surface sync errors as HTTP 502 so the frontend can distinguish
    // "sync ran but GitHub had an error" from "lab list fetch failed"
    if (result.status === "error") {
      res.status(502).json(result);
      return;
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Sync failed unexpectedly" });
  }
});

export default router;
