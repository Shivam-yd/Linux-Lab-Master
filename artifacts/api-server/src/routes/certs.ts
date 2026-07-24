import { Router } from "express";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { certRecordsTable, labProgressTable } from "@workspace/db/schema";
import { requireAuth } from "../middleware/auth";
import { getAllLabs } from "../lib/labs/registry";

const router = Router();

/** POST /certs — register a cert so it can be publicly verified. Auth required.
 *  Server re-verifies eligibility from the DB — client cannot fake completion. */
router.post("/certs", requireAuth, async (req, res): Promise<void> => {
  const { certId, studentName, track, level } = req.body;
  if (!certId || !track) { res.status(400).json({ error: "Missing fields" }); return; }

  const studentId = req.studentId;
  const levelNum = level != null ? Number(level) : null;

  // ── Server-side eligibility check ───────────────────────────────────────────
  const allLabs = await getAllLabs();
  const scoped = allLabs.filter(
    l => l.track === track && (levelNum == null || l.level === levelNum),
  );
  if (scoped.length === 0) {
    res.status(400).json({ error: "No labs found for that track/level" }); return;
  }

  const labIds = scoped.map(l => l.id);
  const passedRows = await db
    .select({ labId: labProgressTable.labId, lastAttemptAt: labProgressTable.lastAttemptAt })
    .from(labProgressTable)
    .where(and(
      eq(labProgressTable.studentId, studentId),
      eq(labProgressTable.status, "passed"),
      inArray(labProgressTable.labId, labIds),
    ));

  if (passedRows.length < scoped.length) {
    res.status(403).json({ error: "Not all labs completed" }); return;
  }

  // ── Compute earnedAt server-side (max lastAttemptAt of passed labs) ─────────
  const earnedAt = passedRows
    .map(r => r.lastAttemptAt)
    .filter((d): d is Date => d != null)
    .reduce<Date>((max, d) => (d > max ? d : max), new Date(0));

  const expiresAt = new Date(earnedAt);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  const name: string = (studentName as string | undefined) ?? "Student";

  await db.execute(sql`
    INSERT INTO cert_records (cert_id, student_id, student_name, track, level, earned_at, expires_at)
    VALUES (${certId}, ${studentId}, ${name}, ${track}, ${levelNum}, ${earnedAt}, ${expiresAt})
    ON CONFLICT (cert_id) DO UPDATE SET
      student_name = ${name},
      earned_at    = ${earnedAt},
      expires_at   = ${expiresAt}
  `);

  res.json({ ok: true, earnedAt: earnedAt.toISOString() });
});

/** GET /certs/:certId — public, no auth.
 *  Returns 404 if not found, 410 if expired (row is deleted on expiry). */
router.get("/certs/:certId", async (req, res): Promise<void> => {
  const rows = await db.execute(sql`
    SELECT cert_id, student_id, student_name, track, level, earned_at, expires_at
    FROM cert_records
    WHERE cert_id = ${req.params.certId}
    LIMIT 1
  `);
  if (!rows.rows.length) { res.status(404).json({ error: "Certificate not found" }); return; }

  const raw = rows.rows[0] as {
    cert_id: string; student_id: string | null; student_name: string;
    track: string; level: number | null; earned_at: Date; expires_at: Date;
  };

  if (raw.expires_at < new Date()) {
    // Hard-delete the expired row so it no longer lingers in the DB.
    await db.execute(sql`DELETE FROM cert_records WHERE cert_id = ${req.params.certId}`);
    res.status(410).json({ error: "Certificate expired" }); return;
  }

  // Return in the camelCase shape the frontend expects.
  res.json({
    certId:      raw.cert_id,
    studentId:   raw.student_id,
    studentName: raw.student_name,
    track:       raw.track,
    level:       raw.level,
    earnedAt:    raw.earned_at,
    expiresAt:   raw.expires_at,
  });
});

export default router;
