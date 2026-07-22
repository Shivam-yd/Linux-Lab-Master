import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

export type Plan = "linux-starter" | "devops-pro";

// Tracks that require devops-pro plan.
export const PRO_TRACKS = new Set(["docker", "terraform", "jenkins", "git"]);

/**
 * Returns the effective plan for a user: override > subscription > default.
 * Defaults to "linux-starter" if no row exists.
 */
export async function getEffectivePlan(userId: string): Promise<Plan> {
  const result = await db.execute(sql`
    SELECT plan FROM plan_overrides
    WHERE user_id = ${userId}
      AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1
  `);
  if (result.rows.length > 0) return (result.rows[0] as { plan: Plan }).plan;

  const sub = await db.execute(sql`
    SELECT plan FROM subscriptions
    WHERE user_id = ${userId} AND status = 'active'
    LIMIT 1
  `);
  if (sub.rows.length > 0) return (sub.rows[0] as { plan: Plan }).plan;

  return "linux-starter";
}
