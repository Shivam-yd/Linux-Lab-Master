import { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { sql } from "drizzle-orm";
import { auth } from "../lib/auth";
import { db } from "@workspace/db";
import { stopSession } from "../lib/docker/manager";
import { logger } from "../lib/logger";
import { getEffectivePlan, hasPlanAccess } from "../lib/plan";

const router = Router();

/**
 * DELETE /account
 * Self-service account deletion. Permanently removes all data for the
 * authenticated user: sessions, progress, certificates, and auth rows.
 */
router.delete("/account", async (req, res): Promise<void> => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session?.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const userId = session.user.id;

  try {
    // Stop any running lab container for this user before wiping data.
    try {
      await stopSession(userId);
    } catch {
      // Non-fatal — a dangling container is less bad than a stuck account.
    }

    await db.transaction(async (tx) => {
      await tx.execute(sql`DELETE FROM session             WHERE user_id  = ${userId}`);
      await tx.execute(sql`DELETE FROM lab_sessions        WHERE student_id = ${userId}`);
      await tx.execute(sql`DELETE FROM lab_progress        WHERE student_id = ${userId}`);
      await tx.execute(sql`DELETE FROM cert_records        WHERE student_id = ${userId}`);
      await tx.execute(sql`DELETE FROM lab_ratings         WHERE student_id = ${userId}`);
      await tx.execute(sql`DELETE FROM password_reset_requests WHERE user_id = ${userId}`);
      await tx.execute(sql`DELETE FROM subscriptions        WHERE user_id = ${userId}`);
      await tx.execute(sql`DELETE FROM students            WHERE id = ${userId}`);
      await tx.execute(sql`DELETE FROM account             WHERE user_id = ${userId}`);
      await tx.execute(sql`DELETE FROM "user"              WHERE id = ${userId}`);
    });

    logger.info({ userId }, "account: self-deletion completed");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ userId, err }, "account: self-deletion failed");
    res.status(500).json({ error: "Deletion failed. Please try again." });
  }
});

/** GET /account/plan — returns the caller's effective plan + whether they've chosen one */
router.get("/account/plan", async (req, res): Promise<void> => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session?.user?.id) { res.status(401).json({ error: "Not authenticated" }); return; }
  const [plan, hasSubscription] = await Promise.all([
    getEffectivePlan(session.user.id),
    hasPlanAccess(session.user.id),
  ]);
  res.json({ plan, hasSubscription });
});

/** POST /account/plan — choose a free plan (creates subscription row) */
router.post("/account/plan", async (req, res): Promise<void> => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session?.user?.id) { res.status(401).json({ error: "Not authenticated" }); return; }
  const { plan } = req.body as { plan?: string };
  if (plan !== "linux-starter" && plan !== "devops-pro") {
    res.status(400).json({ error: "Invalid plan" }); return;
  }
  await db.execute(sql`
    INSERT INTO subscriptions (user_id, plan, status)
    VALUES (${session.user.id}, ${plan}, 'active')
    ON CONFLICT (user_id) DO UPDATE SET plan = ${plan}, status = 'active', updated_at = NOW()
  `);
  res.json({ ok: true });
});

export default router;
