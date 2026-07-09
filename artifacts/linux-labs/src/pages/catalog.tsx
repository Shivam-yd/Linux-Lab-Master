import { useState, useMemo } from "react"
import { Link, useLocation } from "wouter"
import { useListLabs, useListProgress } from "@workspace/api-client-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Terminal, Layers, Lock, CheckCircle2, PlayCircle,
  Clock, ChevronRight, Trophy, Star, Cpu, ChevronDown, ChevronUp,
  Award, Hourglass, Unlock
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
  const [, navigate] = useLocation()

  // Ensure activeTrack stays valid once data loads
  const resolvedTrack = tracks.includes(activeTrack) ? activeTrack : (tracks[0] ?? "linux")

  const handleTrackChange = (track: string) => {
    setActiveTrack(track)
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

  // Track-wide stats
  const trackStats = useMemo(() => {
    if (!labs) return { completed: 0, pending: 0, unlocked: 0, locked: 0, total: 0 }
    const trackLabs = labs.filter(l => l.track === resolvedTrack)
    const total = trackLabs.length
    const completed = trackLabs.filter(l => progressByLabId[l.id]?.status === "passed").length
    const pending   = trackLabs.filter(l => progressByLabId[l.id]?.status === "in_progress").length
    const unlocked  = total - completed - pending  // not started but accessible
    return { completed, pending, unlocked, locked: 0, total }
  }, [labs, resolvedTrack, progressByLabId])

  // Cumulative lab counts per level (for milestone positioning)
  const milestones = useMemo(() => {
    let cum = 0
    return levels.map(({ level, total, passed }) => {
      cum += total
      return { level, cumTotal: cum, passed }
    })
  }, [levels])

  const totalLabs   = trackStats.total
  const totalPassed = trackStats.completed

  // First lab in track that isn't passed — for the Start/Continue button
  const nextLabId = useMemo(() => {
    if (!labs) return null
    const trackLabs = labs
      .filter(l => l.track === resolvedTrack)
      .sort((a, b) => a.order - b.order)
    return trackLabs.find(l => progressByLabId[l.id]?.status !== "passed")?.id ?? trackLabs[0]?.id ?? null
  }, [labs, resolvedTrack, progressByLabId])

  const [expanded, setExpanded] = useState(true)

  // Sidebar: track which levels are open
  const [openLevels, setOpenLevels] = useState<Record<number, boolean>>({ 1: true })
  const toggleLevel = (lvl: number) =>
    setOpenLevels(prev => ({ ...prev, [lvl]: !prev[lvl] }))

  // View mode: by-level shows one card per track+level combo
  const [viewMode, setViewMode] = useState<"by-level" | "by-course">("by-level")

  // All track+level combos for "By Level" view
  type LabItem = NonNullable<typeof labs>[number]
  const trackLevelCards = useMemo(() => {
    if (!labs) return [] as { track: string; level: number; lvlLabs: LabItem[]; passed: number; total: number }[]
    const cards: { track: string; level: number; lvlLabs: LabItem[]; passed: number; total: number }[] = []
    const trackOrder = ["linux", "terraform"]
    const allTracks = [...new Set(labs.map((l: LabItem) => l.track))]
    const sorted = [...trackOrder.filter(t => allTracks.includes(t)), ...allTracks.filter(t => !trackOrder.includes(t))]
    sorted.forEach(track => {
      const tLabs = labs.filter((l: LabItem) => l.track === track)
      const lvlNums = [...new Set(tLabs.map((l: LabItem) => l.level as number))].sort((a, b) => a - b)
      lvlNums.forEach(lvl => {
        const lvlLabs = tLabs.filter((l: LabItem) => (l.level as number) === lvl).sort((a: LabItem, b: LabItem) => (a.order as number) - (b.order as number))
        const passed = lvlLabs.filter((l: LabItem) => progressByLabId[l.id as string]?.status === "passed").length
        cards.push({ track, level: lvl, lvlLabs, passed, total: lvlLabs.length })
      })
    })
    return cards
  }, [labs, progressByLabId])


  const filteredCards = useMemo(() =>
    trackLevelCards.filter(c => c.track === resolvedTrack),
  [trackLevelCards, resolvedTrack])

  // Which "By Level" cards are expanded
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({})
  const toggleCard = (key: string) => setExpandedCards(prev => ({ ...prev, [key]: !prev[key] }))

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

        {/* Track list + level dropdowns */}
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

                // labs for this track grouped by level (only shown when active)
                const trackLevelGroups = !labs ? [] : (() => {
                  const tLabs = labs.filter(l => l.track === track)
                  const lvlNums = [...new Set(tLabs.map(l => l.level))].sort((a, b) => a - b)
                  return lvlNums.map(lvl => ({
                    level: lvl,
                    labs: tLabs.filter(l => l.level === lvl).sort((a, b) => a.order - b.order),
                  }))
                })()

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
                    <ChevronRight className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground/40")} />
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
      <div className="flex-1 overflow-y-auto p-6 space-y-4">

        {/* ── Tab switcher + level filter ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
            {(["by-level", "by-course"] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                  viewMode === mode
                    ? "bg-primary/15 text-foreground border border-primary/20"
                    : "text-muted-foreground hover:text-foreground/80"
                )}
              >
                {mode === "by-level" ? "By Level" : "By Course"}
              </button>
            ))}
          </div>

        </div>

        {/* ── By Level view ── */}
        {viewMode === "by-level" && (
          <div className="space-y-3">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-card border border-border animate-pulse" />
                ))
              : filteredCards.map(({ track, level, lvlLabs, passed, total }) => {
                  const tm = TRACK_META[track] ?? { label: track, icon: Cpu, accentHex: "#94a3b8" }
                  const lm = LEVEL_META[level] ?? LEVEL_META[1]
                  const cardKey = `${track}-${level}`
                  const isOpen = !!expandedCards[cardKey]
                  const allPassed = passed === total && total > 0
                  const anyInProgress = lvlLabs.some(l => progressByLabId[l.id]?.status === "in_progress")

                  return (
                    <div key={cardKey} className="rounded-xl border border-border bg-card overflow-hidden">
                      {/* Card header row */}
                      <div
                        className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-muted/20 transition-colors"
                        onClick={() => toggleCard(cardKey)}
                      >
                        {/* Icon */}
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border"
                          style={{ background: `${tm.accentHex}18`, borderColor: `${tm.accentHex}35` }}
                        >
                          <tm.icon className="w-6 h-6" style={{ color: tm.accentHex }} />
                        </div>

                        {/* Title */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-muted-foreground leading-none mb-1">
                            Level {level} <span style={{ color: lm.accentHex }}>— {lm.name}</span>
                          </p>
                          <p className="text-base font-bold leading-tight">{tm.label}</p>
                        </div>

                        {/* Right: status + progress + chevron */}
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-muted-foreground tabular-nums">{passed}/{total}</span>
                          {allPassed ? (
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-teal-500/15 text-teal-400 border border-teal-500/25">
                              <CheckCircle2 className="w-3 h-3" /> Completed
                            </span>
                          ) : anyInProgress ? (
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/25">
                              <PlayCircle className="w-3 h-3" /> In Progress
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-muted/40 text-muted-foreground border border-border">
                              Not Started
                            </span>
                          )}
                          <button className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground transition-colors">
                            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded lab rows */}
                      {isOpen && (
                        <div className="border-t border-border divide-y divide-border/50">
                          {lvlLabs.map(lab => {
                            const prog = progressByLabId[lab.id]
                            const isPassed     = prog?.status === "passed"
                            const isInProgress = prog?.status === "in_progress"
                            const score = prog?.bestScore ?? 0
                            return (
                              <div key={lab.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/20 transition-colors group">
                                <div className="w-7 h-7 flex items-center justify-center shrink-0">
                                  {isPassed
                                    ? <CheckCircle2 className="w-4.5 h-4.5 text-teal-400" />
                                    : isInProgress
                                    ? <PlayCircle className="w-4.5 h-4.5 text-blue-400" />
                                    : <div className="w-2.5 h-2.5 rounded-full border-2 border-muted-foreground/40" />
                                  }
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-sm font-medium group-hover:text-primary transition-colors">{lab.title}</span>
                                    <Badge variant="outline" className={cn("text-[10px] shrink-0", DIFFICULTY_BADGE[lab.difficulty])}>
                                      {lab.difficulty}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1"><Terminal className="w-3 h-3" />{lab.category}</span>
                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{lab.estimatedMinutes}m</span>
                                    {score > 0 && (
                                      <span className="flex items-center gap-1">
                                        <Trophy className="w-3 h-3 text-primary/70" />
                                        <span className="font-mono">{score}%</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <Link href={`/labs/${lab.id}`}>
                                  <button className={cn(
                                    "shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-all",
                                    isPassed
                                      ? "bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20"
                                      : isInProgress
                                      ? "bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20"
                                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                                  )}>
                                    {isPassed ? <><Star className="w-3 h-3" /> Review</>
                                      : isInProgress ? <><PlayCircle className="w-3 h-3" /> Continue</>
                                      : <><PlayCircle className="w-3 h-3" /> Start Lab</>}
                                  </button>
                                </Link>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })
            }
          </div>
        )}

        {/* ── By Course view (existing) ── */}
        {viewMode === "by-course" && (loading ? (
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="w-12 h-12 rounded-lg" />
              <div className="flex-1 space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-3 w-64" /></div>
              <Skeleton className="w-20 h-8 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-full rounded-full" />
            <div className="grid grid-cols-4 gap-3">
              {[0,1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">

            {/* Header row */}
            <div className="flex items-center gap-4 px-5 pt-5 pb-4">
              {/* Track icon badge */}
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 border"
                style={{ background: `${meta.accentHex}15`, borderColor: `${meta.accentHex}35` }}
              >
                <meta.icon className="w-6 h-6" style={{ color: meta.accentHex }} />
              </div>

              {/* Title + description */}
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-bold leading-tight">{meta.label}</h1>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{meta.description}</p>
              </div>


              {/* Start / Continue button */}
              {nextLabId && (
                <Link href={`/labs/${nextLabId}`}>
                  <button
                    className="shrink-0 px-5 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
                    style={{ background: meta.accentHex, color: "#0f172a" }}
                  >
                    {totalPassed > 0 ? "Continue" : "Start"}
                  </button>
                </Link>
              )}

              {/* Collapse chevron */}
              <button
                onClick={() => setExpanded(v => !v)}
                className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground transition-colors shrink-0"
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {/* Milestone progress bar */}
            <div className="px-5 pb-4">
              <p className="text-xs text-muted-foreground mb-3">
                Progress: {totalPassed}/{totalLabs} Labs
              </p>
              <div className="relative h-6 flex items-center">
                {/* Track */}
                <div className="absolute inset-x-0 h-2 rounded-full bg-muted/60" />
                {/* Fill */}
                {totalLabs > 0 && (
                  <div
                    className="absolute left-0 h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(2, (totalPassed / totalLabs) * 100)}%`,
                      background: `linear-gradient(to right, ${meta.accentHex}, ${meta.accentHex}99)`,
                    }}
                  />
                )}
                {/* Milestone markers */}
                {milestones.map(({ level, cumTotal, passed: lvlPassed }) => {
                  const pos = totalLabs > 0 ? (cumTotal / totalLabs) * 100 : 0
                  const lm = LEVEL_META[level] ?? LEVEL_META[1]
                  const isReached = totalPassed >= cumTotal - (levels.find(l => l.level === level)?.total ?? 0)
                  const isComplete = totalPassed >= cumTotal
                  return (
                    <div
                      key={level}
                      className="absolute flex flex-col items-center"
                      style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
                    >
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                          isComplete
                            ? "border-transparent"
                            : isReached
                            ? "border-muted bg-background"
                            : "border-muted/40 bg-background"
                        )}
                        style={isComplete ? { background: lm.accentHex, borderColor: lm.accentHex } : {}}
                      >
                        {isComplete
                          ? <Award className="w-3 h-3 text-slate-900" />
                          : <Lock className="w-2.5 h-2.5 text-muted-foreground/50" />
                        }
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Level labels */}
              <div className="relative h-5 mt-1">
                {milestones.map(({ level, cumTotal }) => {
                  const pos = totalLabs > 0 ? (cumTotal / totalLabs) * 100 : 0
                  const lm = LEVEL_META[level] ?? LEVEL_META[1]
                  return (
                    <span
                      key={level}
                      className="absolute text-[10px] text-muted-foreground whitespace-nowrap"
                      style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
                    >
                      Level {level}
                    </span>
                  )
                })}
              </div>
            </div>

            {/* Stat boxes */}
            <div className="grid grid-cols-4 gap-2 px-5 pb-5">
              {[
                { count: trackStats.completed, label: "Completed", color: "#2dd4bf", Icon: CheckCircle2 },
                { count: trackStats.pending,   label: "Pending",   color: "#f59e0b", Icon: Hourglass   },
                { count: trackStats.unlocked,  label: "Unlocked",  color: "#818cf8", Icon: Unlock      },
                { count: trackStats.locked,    label: "Locked",    color: "#94a3b8", Icon: Lock        },
              ].map(({ count, label, color, Icon }) => (
                <div key={label} className="rounded-lg bg-background border border-border p-3 flex flex-col gap-1">
                  <span className="text-2xl font-bold tabular-nums" style={{ color }}>{count}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Icon className="w-3 h-3 shrink-0" style={{ color }} />
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* ── Expandable level + lab cards ── */}
        {viewMode === "by-course" && !loading && expanded && (
          <div className="space-y-4">
            {levels.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center border border-dashed border-border rounded-xl">
                <meta.icon className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No labs in this track yet.</p>
              </div>
            ) : (
              levels.map(({ level, labs: lvlLabs, locked, passed, total }) => {
                const lm = LEVEL_META[level] ?? LEVEL_META[1]
                const pct = total ? Math.round((passed / total) * 100) : 0

                return (
                  <div
                    key={level}
                    className={cn(
                      "rounded-xl border bg-card overflow-hidden transition-all duration-200",
                      locked ? "border-border opacity-60" : "border-border"
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
                          <span className="text-sm font-semibold">Level {level} — {lm.name}</span>
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
                          <Progress value={pct} className="w-24 h-1.5" />
                          <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
                            {passed}/{total}
                          </span>
                          <Badge variant="outline" className={cn("text-[10px] font-medium", lm.badgeClass)}>
                            {pct === 100 ? "Cleared" : pct > 0 ? "In Progress" : "Not Started"}
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* Lab rows */}
                    <div className="divide-y divide-border/50">
                      {lvlLabs.map(lab => {
                        const prog = progressByLabId[lab.id]
                        const isPassed    = prog?.status === "passed"
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
                            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                              {isPassed
                                ? <CheckCircle2 className="w-5 h-5 text-teal-400" />
                                : isInProgress
                                ? <PlayCircle className="w-5 h-5 text-blue-400" />
                                : <div className="w-2.5 h-2.5 rounded-full border-2 border-muted-foreground/40" />
                              }
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={cn(
                                  "text-sm font-medium leading-tight",
                                  locked ? "text-muted-foreground" : "text-foreground group-hover:text-primary transition-colors"
                                )}>
                                  {lab.title}
                                </span>
                                <Badge variant="outline" className={cn("text-[10px] shrink-0", DIFFICULTY_BADGE[lab.difficulty])}>
                                  {lab.difficulty}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Terminal className="w-3 h-3" />{lab.category}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />{lab.estimatedMinutes}m
                                </span>
                                {score > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Trophy className="w-3 h-3 text-primary/70" />
                                    <span className="font-mono">{score}%</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            {!locked && score > 0 && (
                              <div className="w-20 shrink-0">
                                <Progress value={score} className="h-1" />
                              </div>
                            )}

                            {!locked ? (
                              <Link href={`/labs/${lab.id}`}>
                                <button className={cn(
                                  "shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-all",
                                  isPassed
                                    ? "bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20"
                                    : isInProgress
                                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20"
                                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                                )}>
                                  {isPassed
                                    ? <><Star className="w-3 h-3" /> Review</>
                                    : isInProgress
                                    ? <><PlayCircle className="w-3 h-3" /> Continue</>
                                    : <><PlayCircle className="w-3 h-3" /> Start Lab</>
                                  }
                                </button>
                              </Link>
                            ) : (
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
          </div>
        )}
      </div>
    </div>
  )
}
