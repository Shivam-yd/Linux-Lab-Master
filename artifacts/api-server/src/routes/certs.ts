import { Router } from "express";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { certRecordsTable, labProgressTable } from "@workspace/db/schema";
import { requireAuth } from "../middleware/auth";
import { getAllLabs } from "../lib/labs/registry";

const router = Router();

router.post("/certs", requireAuth, async (req, res): Promise<void> => {
  const { certId, studentName, track, level } = req.body;
  if (!certId || !track) { res.status(400).json({ error: "Missing fields" }); return; }

  const levelNum = level != null ? Number(level) : null;
  const allLabs = await getAllLabs();
  const scoped = allLabs.filter(l => l.track === track && (levelNum == null || l.level === levelNum));
  if (!scoped.length) { res.status(400).json({ error: "No labs found for that track/level" }); return; }

  const passed = await db
    .select({ lastAttemptAt: labProgressTable.lastAttemptAt })
    .from(labProgressTable)
    .where(and(
      eq(labProgressTable.studentId, req.studentId),
      eq(labProgressTable.status, "passed"),
      inArray(labProgressTable.labId, scoped.map(l => l.id)),
    ));

  if (passed.length < scoped.length) { res.status(403).json({ error: "Not all labs completed" }); return; }

  const earnedAt = passed.map(r => r.lastAttemptAt).filter((d): d is Date => d != null)
    .reduce<Date>((max, d) => (d > max ? d : max), new Date(0));
  const expiresAt = new Date(earnedAt);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  await db.execute(sql`
    INSERT INTO cert_records (cert_id, student_id, student_name, track, level, earned_at, expires_at)
    VALUES (${certId}, ${req.studentId}, ${(studentName as string | undefined) ?? "Student"}, ${track}, ${levelNum}, ${earnedAt}, ${expiresAt})
    ON CONFLICT (cert_id) DO UPDATE SET
      student_name = EXCLUDED.student_name,
      earned_at    = EXCLUDED.earned_at,
      expires_at   = EXCLUDED.expires_at
  `);

  res.json({ ok: true });
});

/** GET /certs/:certId — public. Returns 404 if not found, 410 if expired (row deleted). */
router.get("/certs/:certId", async (req, res): Promise<void> => {
  const rows = await db.select().from(certRecordsTable).where(eq(certRecordsTable.certId, req.params.certId)).limit(1);
  if (!rows.length) { res.status(404).json({ error: "Certificate not found" }); return; }
  const row = rows[0] as typeof certRecordsTable.$inferSelect;
  if ((row as unknown as { expiresAt: Date }).expiresAt < new Date()) {
    await db.execute(sql`DELETE FROM cert_records WHERE cert_id = ${req.params.certId}`);
    res.status(410).json({ error: "Certificate expired" }); return;
  }
  res.json(row);
});

export default router;
