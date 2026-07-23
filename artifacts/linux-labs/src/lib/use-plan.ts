import { useQuery } from "@tanstack/react-query"
import { useSession } from "@/lib/auth-client"

export type Plan = "linux-starter" | "devops-pro"
export const PRO_TRACKS = new Set(["docker", "terraform", "jenkins", "git"])

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

export function usePlan() {
  const { data: session, isPending } = useSession()
  const { data, isLoading } = useQuery<{ plan: Plan; hasSubscription: boolean; trialEndsAt: string | null }>({
    queryKey: ["account", "plan"],
    queryFn: () => fetch(`${basePath}/api/account/plan`, { credentials: "include" }).then(r => r.json()),
    enabled: !!session?.user,
    staleTime: 60_000,
  })
  return {
    plan: data?.plan ?? "linux-starter" as Plan,
    hasSubscription: data?.hasSubscription ?? false,
    trialEndsAt: data?.trialEndsAt ?? null,
    isLoading: isPending || isLoading,
  }
}
