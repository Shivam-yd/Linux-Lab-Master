import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

export type Plan = "linux-starter" | "devops-pro";

// Tracks that require devops-pro plan.
export const PRO_TRACKS = new Set(["docker", "terraform", "jenkins", "git"]);

export async function getLabAccessError(userId: string, track: string) {
  if (!await hasPlanAccess(userId)) {
    return { status: 402, error: "Choose a plan to access labs", requiresPlan: true } as const;
  }
  if (PRO_TRACKS.has(track) && await getEffectivePlan(userId) !== "devops-pro") {
    return { status: 403, error: "DevOps Pro plan required for this track", upgrade: true } as const;
  }
  return null;
}

/** Returns true if the user has any active subscription or plan override. */
export async function hasPlanAccess(userId: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 FROM subscriptions
    WHERE user_id = ${userId} AND status = 'active'
      AND (
        plan <> 'devops-pro'
        OR provider_ref IS NOT NULL
        OR trial_ends_at IS NULL
        OR trial_ends_at > NOW()
      )
    UNION ALL
    SELECT 1 FROM plan_overrides
      WHERE user_id = ${userId} AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1
  `);
  return result.rows.length > 0;
}

/** Returns the effective plan: override > subscription > linux-starter. */
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
      AND (
        plan <> 'devops-pro'
        OR provider_ref IS NOT NULL
        OR trial_ends_at IS NULL
        OR trial_ends_at > NOW()
      )
    LIMIT 1
  `);
  if (sub.rows.length > 0) return (sub.rows[0] as { plan: Plan }).plan;

  return "linux-starter";
}
