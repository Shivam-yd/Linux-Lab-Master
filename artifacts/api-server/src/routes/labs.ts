import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { labProgressTable } from "@workspace/db/schema";
import {
  ListLabsResponse,
  GetLabParams,
  GetLabResponse,
  ListProgressResponse,
} from "@workspace/api-zod";
import { LABS, getLabById } from "../lib/labs/registry";
import { studentIdentity } from "../middleware/student";

const router: IRouter = Router();

router.use(studentIdentity);

router.get("/labs", async (_req, res): Promise<void> => {
  const labs = LABS.map((lab) => ({
    id: lab.id,
    title: lab.title,
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
  const lab = getLabById(params.data.labId);
  if (!lab) {
    res.status(404).json({ error: "Lab not found" });
    return;
  }
  res.json(
    GetLabResponse.parse({
      id: lab.id,
      title: lab.title,
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

router.get("/progress", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(labProgressTable)
    .where(eq(labProgressTable.studentId, req.studentId));

  const byLabId = new Map(rows.map((r) => [r.labId, r]));
  const progress = LABS.map((lab) => {
    const row = byLabId.get(lab.id);
    return {
      labId: lab.id,
      status: row?.status ?? "not_started",
      bestScore: row?.bestScore ?? 0,
      lastAttemptAt: row?.lastAttemptAt ?? null,
    };
  });
  res.json(ListProgressResponse.parse(progress));
});

export default router;
