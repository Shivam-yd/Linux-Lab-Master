import { Router, type IRouter, type Response } from "express";
import {
  GetLabSessionParams,
  GetLabSessionResponse,
  StartLabSessionParams,
  StartLabSessionResponse,
  StopLabSessionParams,
  ResetLabSessionParams,
  ResetLabSessionResponse,
  VerifyLabParams,
  VerifyLabResponse,
} from "@workspace/api-zod";
import { getLabByIdAsync } from "../lib/labs/registry";
import { requireAuth } from "../middleware/auth";
import { getLabAccessError } from "../lib/plan";
import { issueCert } from "../lib/certs";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import {
  getSessionRow,
  startSession,
  stopSession,
  resetSession,
  verifyLab,
  recordProgress,
} from "../lib/docker/manager";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.use(requireAuth);

async function allowLabAccess(studentId: string, track: string, res: Response): Promise<boolean> {
  const accessError = await getLabAccessError(studentId, track);
  if (accessError) res.status(accessError.status).json(accessError);
  return !accessError;
}

function toSessionResponse(labId: string, terminals: string[], row: Awaited<ReturnType<typeof getSessionRow>>) {
  return {
    labId,
    status: row?.status ?? "none",
    terminals: row?.status === "running" ? terminals : [],
    createdAt: row?.createdAt ?? null,
    errorMessage: row?.errorMessage ?? null,
  };
}

router.get("/labs/:labId/session", async (req, res): Promise<void> => {
  const params = GetLabSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const lab = await getLabByIdAsync(params.data.labId);
  if (!lab) {
    res.status(404).json({ error: "Lab not found" });
    return;
  }
  if (!await allowLabAccess(req.studentId, lab.track, res)) return;
  const row = await getSessionRow(req.studentId, lab.id);
  res.json(
    GetLabSessionResponse.parse(
      toSessionResponse(
        lab.id,
        lab.terminals.map((t) => t.name),
        row,
      ),
    ),
  );
});

router.post("/labs/:labId/session", async (req, res): Promise<void> => {
  const params = StartLabSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const lab = await getLabByIdAsync(params.data.labId);
  if (!lab) {
    res.status(404).json({ error: "Lab not found" });
    return;
  }
  if (!await allowLabAccess(req.studentId, lab.track, res)) return;
  const row = await startSession(req.studentId, lab.id);
  res.json(
    StartLabSessionResponse.parse(
      toSessionResponse(
        lab.id,
        lab.terminals.map((t) => t.name),
        row,
      ),
    ),
  );
});

router.delete("/labs/:labId/session", async (req, res): Promise<void> => {
  const params = StopLabSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const lab = await getLabByIdAsync(params.data.labId);
  if (!lab) {
    res.status(404).json({ error: "Lab not found" });
    return;
  }
  await stopSession(req.studentId, lab.id);
  res.status(204).send();
});

router.post("/labs/:labId/session/reset", async (req, res): Promise<void> => {
  const params = ResetLabSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const lab = await getLabByIdAsync(params.data.labId);
  if (!lab) {
    res.status(404).json({ error: "Lab not found" });
    return;
  }
  if (!await allowLabAccess(req.studentId, lab.track, res)) return;
  const row = await resetSession(req.studentId, lab.id);
  res.json(
    ResetLabSessionResponse.parse(
      toSessionResponse(
        lab.id,
        lab.terminals.map((t) => t.name),
        row,
      ),
    ),
  );
});

router.post("/labs/:labId/verify", async (req, res): Promise<void> => {
  const params = VerifyLabParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const lab = await getLabByIdAsync(params.data.labId);
  if (!lab) {
    res.status(404).json({ error: "Lab not found" });
    return;
  }
  if (!await allowLabAccess(req.studentId, lab.track, res)) return;

  try {
    const checks = await verifyLab(req.studentId, lab.id);
    await recordProgress(req.studentId, lab.id, checks);

    const total = checks.length || 1;
    const passedCount = checks.filter((c) => c.passed).length;
    const score = Math.round((passedCount / total) * 100);
    const labelById = new Map(lab.tasks.map((t) => [t.id, t.description]));

    const allPassed = checks.length > 0 && passedCount === checks.length;

    // Auto-issue cert when this verify completes a track level or full track.
    if (allPassed) {
      const nameRow = await db.execute(sql`SELECT name FROM "user" WHERE id = ${req.studentId} LIMIT 1`);
      const studentName = (nameRow.rows[0] as { name?: string } | undefined)?.name ?? "Student";
      // Fire both checks — issueCert returns null if not yet complete.
      await Promise.all([
        issueCert(req.studentId, studentName, lab.track, lab.level),
        issueCert(req.studentId, studentName, lab.track, null),
      ]);
    }

    res.json(
      VerifyLabResponse.parse({
        labId: lab.id,
        passed: allPassed,
        score,
        checks: checks.map((c) => ({
          id: c.id,
          label: labelById.get(c.id) ?? c.id,
          passed: c.passed,
          message: c.message,
        })),
        verifiedAt: new Date(),
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, labId: lab.id, studentId: req.studentId }, "Verify failed");
    // 409 for expected pre-condition failures (sandbox not running), 500 for
    // everything else (infra/DB/runtime faults) so clients can distinguish
    // user-fixable errors from server-side failures.
    const isPreCondition = message.includes("not running") || message.includes("Start the sandbox");
    res.status(isPreCondition ? 409 : 500).json({ error: message });
  }
});

export default router;
