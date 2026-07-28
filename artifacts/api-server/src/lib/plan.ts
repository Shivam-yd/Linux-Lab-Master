import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

export type Plan = "linux-starter" | "devops-pro";

// Tracks that require devops-pro plan.
export const PRO_TRACKS = new Set(["docker", "terraform", "jenkins", "git"]);

const ACTIVE_SUB = sql`
  status = 'active'
  AND (
    plan <> 'devops-pro'
    OR provider_ref IS NOT NULL
    OR trial_ends_at IS NULL
    OR trial_ends_at > NOW()
  )
`;

/** Single round-trip: returns effective plan, subscription flag, and trial expiry. */
export async function getPlanInfo(userId: string): Promise<{
  plan: Plan;
  hasSubscription: boolean;
  trialEndsAt: Date | null;
}> {
  const result = await db.execute(sql`
    SELECT
      COALESCE(
        (SELECT plan FROM plan_overrides
           WHERE user_id = ${userId}
             AND (expires_at IS NULL OR expires_at > NOW())
           LIMIT 1),
        (SELECT plan FROM subscriptions
           WHERE user_id = ${userId} AND ${ACTIVE_SUB}
           LIMIT 1)
      ) AS effective_plan,
      EXISTS(
        SELECT 1 FROM subscriptions
          WHERE user_id = ${userId} AND ${ACTIVE_SUB}
        UNION ALL
        SELECT 1 FROM plan_overrides
          WHERE user_id = ${userId}
            AND (expires_at IS NULL OR expires_at > NOW())
        LIMIT 1
      ) AS has_subscription,
      (SELECT trial_ends_at FROM subscriptions
         WHERE user_id = ${userId}
         LIMIT 1) AS trial_ends_at
  `);

  const row = result.rows[0] as {
    effective_plan: Plan | null;
    has_subscription: boolean;
    trial_ends_at: Date | null;
  } | undefined;

  return {
    plan: row?.effective_plan ?? "linux-starter",
    hasSubscription: row?.has_subscription ?? false,
    trialEndsAt: row?.trial_ends_at ?? null,
  };
}

export async function getLabAccessError(userId: string, track: string) {
  const { plan, hasSubscription } = await getPlanInfo(userId);
  if (!hasSubscription) {
    return { status: 402, error: "Choose a plan to access labs", requiresPlan: true } as const;
  }
  if (PRO_TRACKS.has(track) && plan !== "devops-pro") {
    return { status: 403, error: "DevOps Pro plan required for this track", upgrade: true } as const;
  }
  return null;
}
