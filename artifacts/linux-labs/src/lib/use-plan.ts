import { useQuery } from "@tanstack/react-query"
import { useSession } from "@/lib/auth-client"

export type Plan = "linux-starter" | "devops-pro"
export const PRO_TRACKS = new Set(["docker", "terraform", "jenkins", "git"])

export function usePlan() {
  const { data: session } = useSession()
  const { data } = useQuery<{ plan: Plan }>({
    queryKey: ["account", "plan"],
    queryFn: () => fetch("/api/account/plan", { credentials: "include" }).then(r => r.json()),
    enabled: !!session?.user,
    staleTime: 60_000,
  })
  return data?.plan ?? "linux-starter"
}
