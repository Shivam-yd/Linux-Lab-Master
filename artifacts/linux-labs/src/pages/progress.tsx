import { useMemo, useState } from "react"
import { Link } from "wouter"
import { useListLabs, useListProgress, useGetMyRank } from "@workspace/api-client-react"
import { useSession } from "@/lib/auth-client"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Zap, Trophy, Award, CheckCircle2,
  ArrowLeft,
  ExternalLink, Star, ScrollText, ChevronDown, Medal
} from "lucide-react"
import { cn } from "@/lib/utils"
import { TRACK_META, DEFAULT_TRACK_META } from "@/lib/track-meta"
import { AccountDropdown } from "@/components/account-dropdown"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

const LEVEL_META: Record<number, { name: string; accentHex: string }> = {
  1: { name: "Foundation",   accentHex: "#22d3ee" },
  2: { name: "Intermediate", accentHex: "#818cf8" },
  3: { name: "Advanced",     accentHex: "#c084fc" },
}

export default function ProgressPage() {
  const { data: session } = useSession()
  const { data: labs, isLoading: labsLoading } = useListLabs()
  const { data: progress, isLoading: progressLoading } = useListProgress()
  const { data: rankData, isLoading: rankLoading } = useGetMyRank()
  const loading = labsLoading || progressLoading

  const progressByLabId = useMemo(() => {
    if (!progress) return {} as Record<string, { status: string; bestScore: number; lastAttemptAt: string | null }>
    return Object.fromEntries(progress.map(p => [p.labId, p]))
  }, [progress])

  const trackOrder = ["linux", "terraform", "jenkins", "docker", "git"]
  const tracks = useMemo(() => {
    if (!labs) return []
    const seen = new Set(labs.map(l => l.track))
    return [...trackOrder.filter(t => seen.has(t)), ...[...seen].filter(t => !trackOrder.includes(t))]
  }, [labs])

  const overallStats = useMemo(() => {
    if (!labs || !progress) return { passed: 0, total: 0 }
    const passed = labs.filter(l => progressByLabId[l.id]?.status === "passed").length
    return { passed, total: labs.length }
  }, [labs, progress, progressByLabId])

  const overallPct = overallStats.total > 0 ? Math.round((overallStats.passed / overallStats.total) * 100) : 0

  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "Student"

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = (track: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(track) ? next.delete(track) : next.add(track)
      return next
    })

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href={`${basePath}/dashboard`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Link>
            <div className="w-px h-4 bg-border/60" />
            <div className="flex items-center gap-2">
              <img src="/logo.svg" className="w-4 h-4 rounded-sm" />
              <span className="font-bold text-sm tracking-tight">DevLabMaster</span>
            </div>
          </div>
          <AccountDropdown />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-4 relative z-10">

        {/* Hero stats */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your Progress</h1>
            <p className="text-muted-foreground mt-1 text-sm">{userName} · all labs across all tracks</p>
          </div>
          <div className="flex items-stretch gap-3 shrink-0">
            <div className="rounded-xl border border-border/70 bg-card px-5 py-4 flex items-center gap-5">
              <Trophy className="w-7 h-7 text-amber-400" />
              <div>
                <p className="text-2xl font-black font-mono leading-none">
                  {loading ? "…" : `${overallStats.passed}/${overallStats.total}`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Labs completed</p>
                <Progress value={overallPct} className="h-1.5 mt-2 w-32 bg-background border border-border/50" />
              </div>
            </div>
            <div className="rounded-xl border border-border/70 bg-card px-5 py-4 flex items-center gap-4">
              <Medal className="w-7 h-7 text-violet-400" />
              <div>
                <p className="text-2xl font-black font-mono leading-none">
                  {rankLoading ? "…" : rankData?.rank != null ? `#${rankData.rank}` : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {rankLoading ? "\u00a0" : rankData?.total ? `of ${rankData.total} students` : "Your rank"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* My Certificates */}
        {!loading && (() => {
          const earned = tracks.filter(track => {
            const trackLabs = (labs ?? []).filter(l => l.track === track)
            return trackLabs.length > 0 && trackLabs.every(l => progressByLabId[l.id]?.status === "passed")
          })
          if (earned.length === 0) return null
          return (
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground">
                <ScrollText className="w-3.5 h-3.5" />
                My Certificates
                <span className="text-border">·</span>
                <span className="text-amber-400">{earned.length}</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {earned.map(track => {
                  const tm = TRACK_META[track] ?? { ...DEFAULT_TRACK_META, label: track }
                  const Icon = tm.icon
                  return (
                    <Link
                      key={track}
                      href={`${basePath}/certificate/${track}`}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors shrink-0"
                    >
                      <Icon className={cn("w-3.5 h-3.5", tm.accentClass)} />
                      <span className="text-sm font-semibold">{tm.label}</span>
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400/30" />
                    </Link>
                  )
                })}
              </div>
            </section>
          )
        })()}

        {/* Per-track sections */}
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-8 w-40" />
              <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
                {Array.from({ length: 4 }).map((_, j) => <Skeleton key={j} className="h-12 border-b border-border/30 rounded-none" />)}
              </div>
            </div>
          ))
        ) : tracks.map(track => {
          const tm = TRACK_META[track] ?? { ...DEFAULT_TRACK_META, label: track }
          const Icon = tm.icon
          const trackLabs = (labs ?? [])
            .filter(l => l.track === track)
            .sort((a, b) => a.level - b.level || a.order - b.order)
          const passed   = trackLabs.filter(l => progressByLabId[l.id]?.status === "passed").length
          const total    = trackLabs.length
          const pct      = total > 0 ? Math.round((passed / total) * 100) : 0
          const complete = passed === total && total > 0

          const open = expanded.has(track)

          return (
            <section key={track} className="rounded-xl border border-border/50 bg-card/60 overflow-hidden">
              {/* Track header — clickable to collapse/expand */}
              <button
                onClick={() => toggle(track)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg border flex items-center justify-center"
                    style={{ background: `${tm.accentHex}10`, borderColor: `${tm.accentHex}30` }}>
                    <Icon className={cn("w-4 h-4", tm.accentClass)} />
                  </div>
                  <h2 className="text-lg font-bold">{tm.label}</h2>
                  {complete && <Award className="w-4 h-4 text-amber-400" />}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-mono text-muted-foreground">{passed}/{total}</span>
                  <Progress value={pct} className="w-24 h-1.5 bg-background border border-border/50" />
                  {complete && (
                    <Link
                      href={`${basePath}/certificate/${track}`}
                      onClick={e => e.stopPropagation()}
                      className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      <Star className="w-3.5 h-3.5" />
                      Certificate
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                  <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
                </div>
              </button>

              {/* Level rows */}
              {open && <div className="rounded-xl border border-border/50 bg-card/80 overflow-hidden divide-y divide-border/30">
                {[...new Set(trackLabs.map(l => l.level))].sort().map(lvl => {
                  const lm = LEVEL_META[lvl] ?? { name: `Level ${lvl}`, accentHex: "#94a3b8" }
                  const lvlLabs = trackLabs.filter(l => l.level === lvl)
                  const lvlPassed = lvlLabs.filter(l => progressByLabId[l.id]?.status === "passed").length
                  const lvlTotal  = lvlLabs.length
                  const lvlPct    = lvlTotal > 0 ? Math.round((lvlPassed / lvlTotal) * 100) : 0
                  const lvlDone   = lvlPassed === lvlTotal && lvlTotal > 0

                  return (
                    <div key={lvl} className="flex items-center gap-5 px-5 py-4">
                      {/* Level badge */}
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                        style={{ background: `${lm.accentHex}10`, borderColor: `${lm.accentHex}30` }}
                      >
                        <span className="text-sm font-black font-mono" style={{ color: lm.accentHex }}>
                          L{lvl}
                        </span>
                      </div>

                      {/* Name + lab count */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold leading-none">{lm.name}</span>
                          {lvlDone && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                        </div>
                        <Progress
                          value={lvlPct}
                          className="h-1.5 bg-background border border-border/50"
                        />
                      </div>

                      {/* Count */}
                      <span className="text-sm font-mono text-muted-foreground shrink-0 w-12 text-right">
                        {lvlPassed}/{lvlTotal}
                      </span>
                    </div>
                  )
                })}
              </div>}
            </section>
          )
        })}
      </main>
    </div>
  )
}
