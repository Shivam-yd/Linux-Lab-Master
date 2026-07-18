import { Router } from "express";
import { eq, and, or, isNull, gt } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { passwordResetRequestsTable } from "@workspace/db/schema";
import { auth } from "../lib/auth";

const router = Router();

// Per-email cooldown — prevents hammering the endpoint with the same address.
// In-memory; resets on server restart (acceptable for this use case).
const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
const lastRequestAt = new Map<string, number>();

/** POST /api/password-reset/request — user submits a reset request by email. */
router.post("/password-reset/request", async (req, res): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email) { res.status(400).json({ error: "Email required" }); return; }

  const lower = email.toLowerCase().trim();

  // Silent cooldown — same response as non-existing email to avoid leaking info.
  const lastAt = lastRequestAt.get(lower);
  if (lastAt && Date.now() - lastAt < COOLDOWN_MS) {
    res.json({ ok: true }); return;
  }
  lastRequestAt.set(lower, Date.now());

  // Look up user in Better Auth's user table
  const result = await db.execute(
    sql`SELECT id FROM "user" WHERE lower(email) = ${lower} LIMIT 1`
  );
  const user = result.rows[0] as { id: string } | undefined;
  if (!user) {
    // Don't reveal whether the email exists
    res.json({ ok: true }); return;
  }

  // Check for any active (pending or non-expired approved) request first.
  const existing = await db
    .select({ id: passwordResetRequestsTable.id, status: passwordResetRequestsTable.status })
    .from(passwordResetRequestsTable)
    .where(and(
      eq(passwordResetRequestsTable.email, lower),
      or(
        eq(passwordResetRequestsTable.status, "pending"),
        // Approved rows are only "active" while the token is still valid.
        and(
          eq(passwordResetRequestsTable.status, "approved"),
          or(isNull(passwordResetRequestsTable.expiresAt), gt(passwordResetRequestsTable.expiresAt, new Date())),
        ),
      ),
    ))
    .limit(1);

  if (existing.length > 0) {
    // Return the current status so the frontend can drop the student into the right stage.
    res.json({ ok: true, status: existing[0].status });
    return;
  }

  await db.insert(passwordResetRequestsTable).values({ userId: user.id, email: lower });
  res.json({ ok: true, status: "pending" });
});

/** GET /api/password-reset/check?email= — returns whether an approved reset is waiting. */
router.get("/password-reset/check", async (req, res): Promise<void> => {
  const email = (req.query.email as string | undefined)?.toLowerCase().trim();
  if (!email) { res.json({ approved: false }); return; }

  const rows = await db
    .select({ id: passwordResetRequestsTable.id })
    .from(passwordResetRequestsTable)
    .where(and(
      eq(passwordResetRequestsTable.email, email),
      eq(passwordResetRequestsTable.status, "approved"),
      // Only report approved if the token is still valid.
      or(isNull(passwordResetRequestsTable.expiresAt), gt(passwordResetRequestsTable.expiresAt, new Date())),
    ))
    .limit(1);

  res.json({ approved: rows.length > 0 });
});

/** POST /api/password-reset/set — set a new password using the stored reset token. */
router.post("/password-reset/set", async (req, res): Promise<void> => {
  const { email, newPassword } = req.body as { email?: string; newPassword?: string };
  if (!email || !newPassword) { res.status(400).json({ error: "Missing fields" }); return; }

  const lower = email.toLowerCase().trim();
  const rows = await db
    .select()
    .from(passwordResetRequestsTable)
    .where(and(
      eq(passwordResetRequestsTable.email, lower),
      eq(passwordResetRequestsTable.status, "approved"),
    ))
    .limit(1);

  if (rows.length === 0 || !rows[0].resetToken) {
    res.status(400).json({ error: "No approved reset found" }); return;
  }

  const request = rows[0];

  // Reject before hitting Better Auth if our own expiry says the token is stale.
  if (request.expiresAt && request.expiresAt < new Date()) {
    res.status(400).json({ error: "Reset token has expired — ask an admin to re-approve your request" }); return;
  }

  // Use Better Auth's resetPassword API with the stored token.
  // Better Auth throws on failure rather than returning an error object.
  try {
    await auth.api.resetPassword({
      body: { newPassword, token: request.resetToken! },
    });
  } catch {
    res.status(400).json({ error: "Failed to set password — token may have expired" }); return;
  }

  // Mark as used
  await db
    .update(passwordResetRequestsTable)
    .set({ status: "used" })
    .where(eq(passwordResetRequestsTable.id, request.id));

  res.json({ ok: true });
});

export default router;
