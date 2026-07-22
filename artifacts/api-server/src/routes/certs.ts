import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { certRecordsTable } from "@workspace/db/schema";
import { requireAuth } from "../middleware/auth";

const router = Router();

/** POST /certs — register a cert so it can be publicly verified. Auth required. */
router.post("/certs", requireAuth, async (req, res): Promise<void> => {
  const { certId, studentName, track, level, earnedAt } = req.body;
  if (!certId || !track || !earnedAt) { res.status(400).json({ error: "Missing fields" }); return; }
  await db.insert(certRecordsTable)
    .values({ certId, studentName, track, level: level ?? null, earnedAt: new Date(earnedAt) })
    .onConflictDoUpdate({ target: certRecordsTable.certId, set: { studentName, earnedAt: new Date(earnedAt) } });
  res.json({ ok: true });
});

/** GET /certs/:certId — public, no auth. */
router.get("/certs/:certId", async (req, res): Promise<void> => {
  const rows = await db.select().from(certRecordsTable).where(eq(certRecordsTable.certId, req.params.certId)).limit(1);
  if (!rows.length) { res.status(404).json({ error: "Certificate not found" }); return; }
  res.json(rows[0]);
});

export default router;
