import { useMeta } from "@/hooks/use-meta"
import { Link } from "wouter"
import { useQuery } from "@tanstack/react-query"
import { useGetMyRank } from "@workspace/api-client-react"
import { useSession } from "@/lib/auth-client"
import { Crown, Medal, Trophy, ArrowLeft } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { AccountDropdown } from "@/components/account-dropdown"
import { ThemeToggle } from "@/components/theme-toggle"
import { BackgroundOrbs } from "@/components/background-orbs"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

type LeaderboardEntry = { name: string; passed: number }

const RANK_STYLE: Record<number, { icon: typeof Crown; cls: string }> = {
  1: { icon: Crown,  cls: "text-amber-400" },
  2: { icon: Medal,  cls: "text-slate-400" },
  3: { icon: Trophy, cls: "text-amber-700" },
}

export default function LeaderboardPage() {
  useMeta("Leaderboard — DevLabMaster", undefined, { indexable: false })
  const { data: session } = useSession()
  const fromProgress = new URLSearchParams(window.location.search).get("from") === "progress"
  const backHref = fromProgress ? `${basePath}/progress` : `${basePath}/dashboard`
  const backLabel = fromProgress ? "Progress" : "Dashboard"
  const { data: rankData, isLoading: rankLoading } = useGetMyRank()
  const { data: board, isLoading: boardLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const r = await fetch(`${basePath}/api/leaderboard`)
      if (!r.ok) throw new Error(`leaderboard fetch failed: ${r.status}`)
      return r.json()
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  })

  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "You"

  return (
    <div className="min-h-screen bg-background text-foreground">
      <BackgroundOrbs />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-primary/20 bg-primary/8 dark:bg-primary/[0.07] backdrop-blur-md">
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href={backHref} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              {backLabel}
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <AccountDropdown />
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-6 py-12 space-y-8">

        {/* Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/8 text-xs font-bold tracking-widest uppercase text-primary/70 mb-4">
            <Trophy className="w-3.5 h-3.5" />
            Top Learners
          </div>
          <h1 className="text-3xl font-black tracking-tight">Leaderboard</h1>
          <p className="text-muted-foreground text-sm">Ranked by labs completed across all tracks</p>
        </div>

        {/* Current user's rank */}
        <div className="rounded-xl border border-primary/25 bg-primary/8 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-sm font-black text-primary">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold">{userName}</p>
              <p className="text-xs text-muted-foreground">Your standing</p>
            </div>
          </div>
          {rankLoading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <div className="text-right">
              <p className="text-2xl font-black font-mono text-primary">
                {rankData?.rank ? `#${rankData.rank}` : "—"}
              </p>
              {rankData?.total && (
                <p className="text-xs text-muted-foreground">of {rankData.total}</p>
              )}
            </div>
          )}
        </div>

        {/* Leaderboard list */}
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          {boardLoading
            ? Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-border/40 last:border-0">
                  <Skeleton className="w-6 h-4" />
                  <Skeleton className="w-7 h-7 rounded-full" />
                  <Skeleton className="h-4 flex-1 max-w-[160px]" />
                  <Skeleton className="h-4 w-14 ml-auto" />
                </div>
              ))
            : !board?.length
              ? (
                <div className="py-16 text-center text-muted-foreground text-sm">
                  No labs completed yet — be the first!
                </div>
              )
              : board.map((entry, i) => {
                  const pos = i + 1
                  const style = RANK_STYLE[pos]
                  const Icon = style?.icon
                  const isMe = entry.name === (session?.user?.name || "")
                  return (
                    <div
                      key={entry.name}
                      className={cn(
                        "flex items-center gap-4 px-5 py-3.5 border-b border-border/40 last:border-0 transition-colors",
                        isMe ? "bg-primary/5" : "hover:bg-muted/30"
                      )}
                    >
                      {/* Position */}
                      <span className={cn("w-6 text-center text-sm font-black font-mono shrink-0", style?.cls ?? "text-muted-foreground/60")}>
                        {Icon ? <Icon className={cn("w-4 h-4 mx-auto", style.cls)} /> : pos}
                      </span>

                      {/* Avatar */}
                      <div className={cn(
                        "w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold shrink-0",
                        isMe ? "bg-primary/15 border-primary/30 text-primary" : "bg-muted/40 border-border/60 text-muted-foreground"
                      )}>
                        {entry.name.charAt(0).toUpperCase()}
                      </div>

                      {/* Name */}
                      <span className={cn("flex-1 text-sm font-semibold truncate", isMe && "text-primary")}>
                        {entry.name}
                        {isMe && <span className="ml-2 text-xs font-normal text-primary/60">(you)</span>}
                      </span>

                      {/* Labs passed */}
                      <span className="text-sm font-black font-mono tabular-nums text-foreground">
                        {entry.passed}
                        <span className="text-xs font-normal text-muted-foreground ml-1">labs</span>
                      </span>
                    </div>
                  )
                })}
        </div>

      </main>
    </div>
  )
}
