import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  registrationSettingsTable,
  registrationRequestsTable,
  registrationInvitesTable,
} from "@workspace/db/schema";

const router = Router();

/** GET /registration-status — public, no auth */
router.get("/registration-status", async (_req, res): Promise<void> => {
  const rows = await db.select().from(registrationSettingsTable).limit(1);
  res.json({ mode: rows[0]?.mode ?? "open" });
});

/** POST /registration-check — public, no auth
 *  Body: { email }
 *  Returns: { status: "approved" | "pending" | "none" }
 */
router.post("/registration-check", async (req, res): Promise<void> => {
  const { email } = req.body ?? {};
  if (!email) { res.status(400).json({ error: "email required" }); return; }
  const normalized = String(email).toLowerCase().trim();

  // Unused invite → can sign up now
  const invite = await db
    .select()
    .from(registrationInvitesTable)
    .where(eq(registrationInvitesTable.email, normalized))
    .limit(1);
  if (invite.length > 0 && invite[0].usedAt === null) {
    res.json({ status: "approved" }); return;
  }

  // Existing request → show its status (pending / approved)
  const request = await db
    .select()
    .from(registrationRequestsTable)
    .where(eq(registrationRequestsTable.email, normalized))
    .limit(1);
  if (request.length > 0) {
    res.json({ status: request[0].status }); return;
  }

  res.json({ status: "none" });
});

/** POST /registration-request — public, no auth */
router.post("/registration-request", async (req, res): Promise<void> => {
  const { name, email } = req.body ?? {};
  if (!name || !email) {
    res.status(400).json({ error: "name and email are required" });
    return;
  }

  // Check mode allows requests
  const rows = await db.select().from(registrationSettingsTable).limit(1);
  const mode = rows[0]?.mode ?? "open";
  if (mode !== "invite_or_request") {
    res.status(400).json({ error: "Account requests are not enabled" });
    return;
  }

  // Deduplicate pending requests for same email
  const existing = await db
    .select()
    .from(registrationRequestsTable)
    .where(eq(registrationRequestsTable.email, email.toLowerCase()))
    .limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "A request for this email already exists" });
    return;
  }

  await db.insert(registrationRequestsTable).values({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    status: "pending",
  });

  res.status(201).json({ ok: true });
});

export default router;
