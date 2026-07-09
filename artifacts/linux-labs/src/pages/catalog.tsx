import { useState, useMemo } from "react"
import { Link } from "wouter"
import { useListLabs, useListProgress } from "@workspace/api-client-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Terminal, Layers, Lock, CheckCircle2, PlayCircle,
  Clock, ChevronRight, Trophy, Star, Cpu, ChevronDown
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────
// Track metadata — add new tracks here only
// ─────────────────────────────────────────
const TRACK_META: Record<string, {
  label: string
  description: string
  icon: React.ElementType
  accentClass: string
  accentHex: string
}> = {
  linux: {
    label: "Linux",
    description: "Master the command line, permissions, users, scripting, and automation.",
    icon: Terminal,
    accentClass: "text-teal-400",
    accentHex: "#2dd4bf",
  },
  terraform: {
    label: "Terraform",
    description: "Learn Infrastructure as Code — write, plan, and apply real configs.",
    icon: Layers,
    accentClass: "text-violet-400",
    accentHex: "#a78bfa",
  },
}

// Level display names and accent colors
const LEVEL_META: Record<number, { name: string; accentHex: string; badgeClass: string }> = {
  1: { name: "Foundation",    accentHex: "#2dd4bf", badgeClass: "bg-teal-500/15 text-teal-300 border-teal-500/30" },
  2: { name: "Intermediate",  accentHex: "#60a5fa", badgeClass: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  3: { name: "Advanced",      accentHex: "#c084fc", badgeClass: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
}

const DIFFICULTY_BADGE: Record<string, string> = {
  beginner:     "bg-teal-500/10 text-teal-400 border-teal-500/20",
  intermediate: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  advanced:     "bg-rose-500/10 text-rose-400 border-rose-500/20",
}

export default function Catalog() {
  const { data: labs, isLoading: labsLoading } = useListLabs()
  const { data: progress, isLoading: progressLoading } = useListProgress()
  const loading = labsLoading || progressLoading

  // Derive sorted unique tracks that have labs
  const tracks = useMemo(() => {
    if (!labs) return []
    const seen = new Set<string>()
    const order = ["linux", "terraform"] // canonical order; unknown tracks appended after
    labs.forEach(l => seen.add(l.track))
    const known = order.filter(t => seen.has(t))
    const rest = [...seen].filter(t => !order.includes(t))
    return [...known, ...rest]
  }, [labs])

  const [activeTrack, setActiveTrack] = useState<string>("linux")
  const [activeLevel, setActiveLevel] = useState<string>("all")

  // Ensure activeTrack stays valid once data loads
  const resolvedTrack = tracks.includes(activeTrack) ? activeTrack : (tracks[0] ?? "linux")

  // Reset level filter when switching tracks
  const handleTrackChange = (track: string) => {
    setActiveTrack(track)
    setActiveLevel("all")
  }

  // Progress map
  const progressByLabId = useMemo(() => {
    if (!progress) return {} as Record<string, { status: string; bestScore: number }>
    return Object.fromEntries(progress.map(p => [p.labId, p]))
  }, [progress])

  // Per-track summary for the sidebar
  const trackSummary = useMemo(() => {
    if (!labs || !progress) return {} as Record<string, { passed: number; total: number }>
    return Object.fromEntries(tracks.map(track => {
      const trackLabs = labs.filter(l => l.track === track)
      const passed = trackLabs.filter(l => progressByLabId[l.id]?.status === "passed").length
      return [track, { passed, total: trackLabs.length }]
    }))
  }, [labs, progress, tracks, progressByLabId])

  // Build level list for the active track
  const levels = useMemo(() => {
    if (!labs) return []
    const trackLabs = labs.filter(l => l.track === resolvedTrack)
    const levelNums = [...new Set(trackLabs.map(l => l.level))].sort((a, b) => a - b)

    return levelNums.map((lvl, idx) => {
      const lvlLabs = trackLabs.filter(l => l.level === lvl).sort((a, b) => a.order - b.order)
      const passed = lvlLabs.filter(l => progressByLabId[l.id]?.status === "passed").length
      const total = lvlLabs.length

      const locked = false

      return { level: lvl, labs: lvlLabs, locked, passed, total }
    })
  }, [labs, resolvedTrack, progressByLabId])

  const meta = TRACK_META[resolvedTrack] ?? {
    label: resolvedTrack,
    description: "",
    icon: Cpu,
    accentClass: "text-slate-400",
    accentHex: "#94a3b8",
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="w-56 shrink-0 flex flex-col bg-card border-r border-border">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
              <Terminal className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none tracking-tight">DevLabs</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">Skill Validation</p>
            </div>
          </div>
        </div>

        {/* Track list */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Tracks
          </p>
          {loading
            ? Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-14 rounded-lg bg-muted/30 animate-pulse mx-1" />
              ))
            : tracks.map(track => {
                const tm = TRACK_META[track]
                const Icon = tm?.icon ?? Cpu
                const isActive = track === resolvedTrack
                const sum = trackSummary[track]
                const pct = sum?.total ? Math.round((sum.passed / sum.total) * 100) : 0

                return (
                  <button
                    key={track}
                    onClick={() => handleTrackChange(track)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 group",
                      isActive
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-muted/40 border border-transparent"
                    )}
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors",
                      isActive ? "bg-primary/20" : "bg-muted/50 group-hover:bg-muted/70"
                    )}>
                      <Icon className={cn("w-3.5 h-3.5", isActive ? "text-primary" : "text-muted-foreground")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium leading-tight",
                        isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground/80"
                      )}>
                        {tm?.label ?? track}
                      </p>
                      {sum && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <Progress value={pct} className="h-1 flex-1 bg-muted/50" />
                          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                            {sum.passed}/{sum.total}
                          </span>
                        </div>
                      )}
                    </div>
                    {isActive && (
                      <ChevronRight className="w-3.5 h-3.5 text-primary shrink-0" />
                    )}
                  </button>
                )
              })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border">
          <p className="text-[10px] text-muted-foreground">
            More tracks coming soon
          </p>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Track header */}
        <header className="shrink-0 border-b border-border bg-card/50 px-8 py-5">
          {loading ? (
            <div className="flex items-center gap-4">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-64" />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${meta.accentHex}18`, border: `1px solid ${meta.accentHex}30` }}
                >
                  <meta.icon className="w-5 h-5" style={{ color: meta.accentHex }} />
                </div>
                <div>
                  <h1 className="text-lg font-semibold leading-tight">{meta.label}</h1>
                  <p className="text-sm text-muted-foreground mt-0.5">{meta.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                {/* Level filter dropdown */}
                {levels.length > 0 && (
                  <Select value={activeLevel} onValueChange={setActiveLevel}>
                    <SelectTrigger className="w-44 h-8 text-xs bg-card border-border">
                      <SelectValue placeholder="All Levels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">All Levels</SelectItem>
                      {levels.map(({ level }) => {
                        const lm = LEVEL_META[level] ?? LEVEL_META[1]
                        return (
                          <SelectItem key={level} value={String(level)} className="text-xs">
                            Level {level} — {lm.name}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                )}
                {trackSummary[resolvedTrack] && (
                  <div className="text-right">
                    <p className="text-2xl font-bold tabular-nums" style={{ color: meta.accentHex }}>
                      {trackSummary[resolvedTrack].passed}
                      <span className="text-muted-foreground text-lg font-normal">
                        /{trackSummary[resolvedTrack].total}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">labs completed</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </header>

        {/* Levels */}
        <main className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-6 py-4 border-b border-border flex items-center gap-3">
                  <Skeleton className="h-6 w-6 rounded" />
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-5 w-16 ml-auto" />
                </div>
                <div className="p-4 space-y-3">
                  {Array.from({ length: 1 }).map((_, j) => (
                    <Skeleton key={j} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              </div>
            ))
          ) : levels.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center border border-dashed border-border rounded-xl">
              <meta.icon className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">No labs in this track yet.</p>
            </div>
          ) : (
            levels
            .filter(({ level }) => activeLevel === "all" || String(level) === activeLevel)
            .map(({ level, labs: lvlLabs, locked, passed, total }) => {
              const lm = LEVEL_META[level] ?? LEVEL_META[1]
              const pct = total ? Math.round((passed / total) * 100) : 0

              return (
                <div
                  key={level}
                  className={cn(
                    "rounded-xl border bg-card overflow-hidden transition-all duration-200",
                    locked ? "border-border opacity-60" : "border-border hover:border-border/80"
                  )}
                >
                  {/* Level header */}
                  <div
                    className="px-6 py-4 flex items-center gap-3 border-b border-border"
                    style={{ borderLeftWidth: 3, borderLeftColor: locked ? "#334155" : lm.accentHex }}
                  >
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-xs font-bold"
                      style={locked
                        ? { background: "#1e293b", color: "#475569" }
                        : { background: `${lm.accentHex}18`, color: lm.accentHex }
                      }
                    >
                      {locked ? <Lock className="w-3.5 h-3.5" /> : level}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          Level {level} — {lm.name}
                        </span>
                        {!locked && passed === total && total > 0 && (
                          <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                        )}
                      </div>
                      {locked && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Complete Level {level - 1} to unlock
                        </p>
                      )}
                    </div>

                    {!locked && (
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-2">
                          <Progress
                            value={pct}
                            className="w-24 h-1.5"
                            style={{ "--progress-color": lm.accentHex } as React.CSSProperties}
                          />
                          <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
                            {passed}/{total}
                          </span>
                        </div>
                        <Badge variant="outline" className={cn("text-[10px] font-medium", lm.badgeClass)}>
                          {pct === 100 ? "Cleared" : pct > 0 ? "In Progress" : "Not Started"}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Labs within this level */}
                  <div className="divide-y divide-border/50">
                    {lvlLabs.map(lab => {
                      const prog = progressByLabId[lab.id]
                      const isPassed = prog?.status === "passed"
                      const isInProgress = prog?.status === "in_progress"
                      const score = prog?.bestScore ?? 0

                      return (
                        <div
                          key={lab.id}
                          className={cn(
                            "flex items-center gap-4 px-6 py-4 group",
                            locked ? "pointer-events-none" : "hover:bg-muted/20 transition-colors"
                          )}
                        >
                          {/* Status icon */}
                          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                            {isPassed
                              ? <CheckCircle2 className="w-5 h-5 text-teal-400" />
                              : isInProgress
                              ? <PlayCircle className="w-5 h-5 text-blue-400" />
                              : <div className="w-2.5 h-2.5 rounded-full border-2 border-muted-foreground/40" />
                            }
                          </div>

                          {/* Lab info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={cn(
                                "text-sm font-medium leading-tight",
                                locked ? "text-muted-foreground" : "text-foreground group-hover:text-primary transition-colors"
                              )}>
                                {lab.title}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn("text-[10px] shrink-0", DIFFICULTY_BADGE[lab.difficulty])}
                              >
                                {lab.difficulty}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Terminal className="w-3 h-3" />
                                {lab.category}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {lab.estimatedMinutes}m
                              </span>
                              {score > 0 && (
                                <span className="flex items-center gap-1">
                                  <Trophy className="w-3 h-3 text-primary/70" />
                                  <span className="font-mono">{score}%</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Score bar */}
                          {!locked && score > 0 && (
                            <div className="w-20 shrink-0">
                              <Progress value={score} className="h-1" />
                            </div>
                          )}

                          {/* CTA */}
                          {!locked && (
                            <Link href={`/labs/${lab.id}`}>
                              <button className={cn(
                                "shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-all",
                                isPassed
                                  ? "bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20"
                                  : isInProgress
                                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20"
                                  : "bg-primary text-primary-foreground hover:bg-primary/90"
                              )}>
                                {isPassed ? (
                                  <><Star className="w-3 h-3" /> Review</>
                                ) : isInProgress ? (
                                  <><PlayCircle className="w-3 h-3" /> Continue</>
                                ) : (
                                  <><PlayCircle className="w-3 h-3" /> Start Lab</>
                                )}
                              </button>
                            </Link>
                          )}

                          {locked && (
                            <div className="shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium bg-muted/30 text-muted-foreground/50 border border-border/50">
                              <Lock className="w-3 h-3" /> Locked
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </main>
      </div>
    </div>
  )
}
