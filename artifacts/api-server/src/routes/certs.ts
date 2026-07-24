import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { certRecordsTable } from "@workspace/db/schema";
import { requireAuth } from "../middleware/auth";
import { issueCert } from "../lib/certs";

const router = Router();

/** POST /certs — register/refresh a cert. Server generates the ID. */
router.post("/certs", requireAuth, async (req, res): Promise<void> => {
  const { studentName, track, level } = req.body;
  if (!track) { res.status(400).json({ error: "Missing track" }); return; }
  const certId = await issueCert(
    req.studentId,
    (studentName as string | undefined) ?? "Student",
    track,
    level != null ? Number(level) : null,
  );
  if (!certId) { res.status(403).json({ error: "Not all labs completed" }); return; }
  res.json({ ok: true, certId });
});

/** GET /certs/mine — list the caller's earned certs. Must be before /:certId. */
router.get("/certs/mine", requireAuth, async (req, res): Promise<void> => {
  const rows = await db.select().from(certRecordsTable).where(eq(certRecordsTable.studentId, req.studentId));
  res.json(rows);
});

/** GET /certs/:certId — public verification. Returns 410 + deletes if expired. */
router.get("/certs/:certId", async (req, res): Promise<void> => {
  const rows = await db.select().from(certRecordsTable)
    .where(eq(certRecordsTable.certId, req.params.certId)).limit(1);
  if (!rows.length) { res.status(404).json({ error: "Certificate not found" }); return; }
  const row = rows[0] as typeof certRecordsTable.$inferSelect;
  if ((row as unknown as { expiresAt: Date }).expiresAt < new Date()) {
    await db.execute(sql`DELETE FROM cert_records WHERE cert_id = ${req.params.certId}`);
    res.status(410).json({ error: "Certificate expired" }); return;
  }
  res.json(row);
});

export default router;
