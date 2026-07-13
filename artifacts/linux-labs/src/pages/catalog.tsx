import { useState, useMemo, useCallback, useEffect } from "react"
import { Link, useLocation } from "wouter"
import { useListLabs, useListProgress } from "@workspace/api-client-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Terminal, Layers, Lock, CheckCircle2, PlayCircle,
  Clock, ChevronRight, Trophy, Star, Cpu, ChevronDown, ChevronUp,
  Award, Hourglass, Unlock, Zap, Server, RefreshCw, CloudDownload, Github,
  Container, GitBranch
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── GitHub sync helpers ───────────────────────────────────────────────────────
interface SyncStatus {
  lastSync: {
    status: "success" | "error"
    labsAdded: number
    labsUpdated: number
    totalRemote: number
    errorMessage: string | null
    triggeredBy: string
    syncedAt: string
  } | null
  totalRemote: number
}

async function fetchSyncStatus(): Promise<SyncStatus> {
  const res = await fetch(`${import.meta.env.BASE_URL}api/labs/sync/status`, { credentials: "include" })
  if (!res.ok) throw new Error("Failed to fetch sync status")
  return res.json()
}

async function triggerSync(): Promise<{ status: string; labsAdded: number; labsUpdated: number; totalRemote: number; errorMessage?: string }> {
  const res = await fetch(`${import.meta.env.BASE_URL}api/labs/sync`, { method: "POST", credentials: "include" })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body.status === "error") {
    throw new Error(body.errorMessage ?? body.error ?? "Sync failed")
  }
  return body
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ─────────────────────────────────────────
// Track metadata
// ─────────────────────────────────────────
const TRACK_META: Record<string, {
  label: string
  description: string
  icon: React.ElementType
  accentClass: string
  accentHex: string
  gradient: string
}> = {
  linux: {
    label: "Linux",
    description: "Master the command line, permissions, users, scripting, and automation.",
    icon: Terminal,
    accentClass: "text-cyan-400",
    accentHex: "#22d3ee",
    gradient: "from-cyan-500/20 to-blue-500/10",
  },
  terraform: {
    label: "Terraform",
    description: "Learn Infrastructure as Code — write, plan, and apply real configs.",
    icon: Layers,
    accentClass: "text-purple-400",
    accentHex: "#c084fc",
    gradient: "from-purple-500/20 to-pink-500/10",
  },
  jenkins: {
    label: "Jenkins",
    description: "Master CI/CD pipelines — install, configure, and manage Jenkins automation.",
    icon: Server,
    accentClass: "text-orange-400",
    accentHex: "#f97316",
    gradient: "from-orange-500/20 to-yellow-500/10",
  },
  docker: {
    label: "Docker",
    description: "Learn containers from the ground up — images, running containers, Dockerfiles, and volumes.",
    icon: Container,
    accentClass: "text-sky-400",
    accentHex: "#38bdf8",
    gradient: "from-sky-500/20 to-blue-500/10",
  },
  git: {
    label: "Git",
    description: "Master version control — commits, branches, merges, remotes, and undoing mistakes.",
    icon: GitBranch,
    accentClass: "text-red-400",
    accentHex: "#f87171",
    gradient: "from-red-500/20 to-orange-500/10",
  },
}

// Level display names and accent colors
const LEVEL_META: Record<number, { name: string; accentHex: string }> = {
  1: { name: "Foundation",    accentHex: "#22d3ee" },
  2: { name: "Intermediate",  accentHex: "#818cf8" },
  3: { name: "Advanced",      accentHex: "#c084fc" },
}

const DIFFICULTY_BADGE: Record<string, string> = {
  beginner:     "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  intermediate: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  advanced:     "bg-rose-500/10 text-rose-400 border-rose-500/20",
}

export default function Catalog() {
  const { data: labs, isLoading: labsLoading, refetch: refetchLabs } = useListLabs()
  const { data: progress, isLoading: progressLoading, refetch: refetchProgress } = useListProgress()
  const loading = labsLoading || progressLoading

  // ── GitHub sync state ──────────────────────────────────────────────────────
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchSyncStatus().then(setSyncStatus).catch(() => {})
  }, [])

  const handleFetchLabs = useCallback(async () => {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const result = await triggerSync()
      const added   = result.labsAdded   ?? 0
      const updated = result.labsUpdated ?? 0
      if (added === 0 && updated === 0) {
        setSyncMessage("Already up to date")
      } else {
        const parts = []
        if (added   > 0) parts.push(`${added} new`)
        if (updated > 0) parts.push(`${updated} updated`)
        setSyncMessage(`✓ ${parts.join(", ")} lab${(added + updated) !== 1 ? "s" : ""} synced`)
      }
      const fresh = await fetchSyncStatus()
      setSyncStatus(fresh)
      await refetchLabs()
      await refetchProgress()
    } catch {
      setSyncMessage("✗ Sync failed — check network or repo")
    } finally {
      setSyncing(false)
    }
  }, [refetchLabs, refetchProgress])

  // Derive sorted unique tracks that have labs
  const tracks = useMemo(() => {
    if (!labs) return []
    const seen = new Set<string>()
    const order = ["linux", "terraform", "jenkins"]
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

    return levelNums.map((lvl) => {
      const lvlLabs = trackLabs.filter(l => l.level === lvl).sort((a, b) => a.order - b.order)
      const passed = lvlLabs.filter(l => progressByLabId[l.id]?.status === "passed").length
      const total = lvlLabs.length
      const locked = false // For now, all levels unlocked
      return { level: lvl, labs: lvlLabs, locked, passed, total }
    })
  }, [labs, resolvedTrack, progressByLabId])

  const meta = TRACK_META[resolvedTrack] ?? {
    label: resolvedTrack,
    description: "",
    icon: Cpu,
    accentClass: "text-slate-400",
    accentHex: "#94a3b8",
    gradient: "from-slate-500/20 to-gray-500/10",
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

  // First lab in track that isn't passed
  const nextLabId = useMemo(() => {
    if (!labs) return null
    const trackLabs = labs
      .filter(l => l.track === resolvedTrack)
      .sort((a, b) => a.order - b.order)
    return trackLabs.find(l => progressByLabId[l.id]?.status !== "passed")?.id ?? trackLabs[0]?.id ?? null
  }, [labs, resolvedTrack, progressByLabId])

  const [expanded, setExpanded] = useState(true)

  // View mode
  const [viewMode, setViewMode] = useState<"by-level" | "by-course">("by-level")

  // All track+level combos for "By Level" view
  type LabItem = NonNullable<typeof labs>[number]
  const trackLevelCards = useMemo(() => {
    if (!labs) return [] as { track: string; level: number; lvlLabs: LabItem[]; passed: number; total: number }[]
    const cards: { track: string; level: number; lvlLabs: LabItem[]; passed: number; total: number }[] = []
    const trackOrder = ["linux", "terraform", "jenkins", "docker", "git"]
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

  // Default expand first card
  useMemo(() => {
    if (filteredCards.length > 0 && Object.keys(expandedCards).length === 0) {
      setExpandedCards({ [`${filteredCards[0].track}-${filteredCards[0].level}`]: true })
    }
  }, [filteredCards])

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="w-64 shrink-0 flex flex-col bg-card border-r border-border relative z-10">
        {/* Brand */}
        <div className="px-6 py-6 border-b border-border/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[50px] -mr-10 -mt-10" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(var(--primary),0.15)]">
              <Zap className="w-5 h-5 text-primary fill-primary/20" />
            </div>
            <div>
              <p className="text-lg font-bold leading-none tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">DevLabs</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium tracking-wide">PRACTICE RANGE</p>
            </div>
          </div>
        </div>

        {/* Track list + level dropdowns */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <p className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
            Tracks
          </p>
          {loading
            ? Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse mx-1" />
              ))
            : tracks.map(track => {
                const tm = TRACK_META[track]
                const Icon = tm?.icon ?? Server
                const isActive = track === resolvedTrack
                const sum = trackSummary[track]
                const pct = sum?.total ? Math.round((sum.passed / sum.total) * 100) : 0

                return (
                  <button
                    key={track}
                    onClick={() => handleTrackChange(track)}
                    className={cn(
                      "w-full flex flex-col gap-2 px-3 py-3 rounded-xl text-left transition-all duration-200 group relative overflow-hidden",
                      isActive
                        ? "bg-muted/40 border border-border/80 shadow-sm"
                        : "hover:bg-muted/20 border border-transparent"
                    )}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-md" />
                    )}
                    <div className="flex items-center gap-3 w-full relative z-10">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                        isActive ? "bg-background border border-border" : "bg-muted/50 group-hover:bg-muted"
                      )}>
                        <Icon className={cn("w-4 h-4", isActive ? tm?.accentClass : "text-muted-foreground")} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-semibold leading-tight",
                          isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground/90"
                        )}>
                          {tm?.label ?? track}
                        </p>
                        {sum && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                            {sum.passed}/{sum.total} Labs
                          </p>
                        )}
                      </div>
                      <ChevronRight className={cn("w-4 h-4 shrink-0 transition-transform", isActive ? "text-foreground translate-x-1" : "text-muted-foreground/40")} />
                    </div>
                    
                    {sum && isActive && (
                      <div className="w-full pl-11 pr-2 relative z-10">
                        <Progress value={pct} className="h-1.5 bg-background border border-border/50" />
                      </div>
                    )}
                  </button>
                )
              })}
        </nav>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-border/50 bg-muted/10">
          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
            <span>SYS_STAT</span>
            <span className="flex items-center gap-1.5 text-primary"><div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"/> ONLINE</span>
          </div>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-background/50 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
        
        <div className="p-8 max-w-6xl mx-auto space-y-8 relative z-10">
          
          {/* Header Area */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border/40">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                {meta.label} Range
              </h1>
              <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-relaxed">
                {meta.description}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-3">
              {/* Fetch Labs button */}
              <div className="flex flex-col items-end gap-1.5">
                <button
                  onClick={handleFetchLabs}
                  disabled={syncing}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all duration-200",
                    syncing
                      ? "bg-muted/40 border-border text-muted-foreground cursor-not-allowed"
                      : "bg-card border-border hover:border-primary/50 hover:bg-muted/30 text-foreground"
                  )}
                >
                  {syncing
                    ? <RefreshCw className="w-4 h-4 animate-spin" />
                    : <CloudDownload className="w-4 h-4" />
                  }
                  {syncing ? "Fetching…" : "Fetch Labs"}
                </button>

                {/* Status line */}
                <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground/70 pr-0.5">
                  {syncMessage ? (
                    <span className={syncMessage.startsWith("✓") ? "text-green-400" : syncMessage.startsWith("✗") ? "text-rose-400" : ""}>
                      {syncMessage}
                    </span>
                  ) : syncStatus?.lastSync ? (
                    <>
                      <Github className="w-3 h-3" />
                      <span>
                        {syncStatus.totalRemote > 0 ? `${syncStatus.totalRemote} remote` : "no remote labs"} ·
                        synced {formatRelativeTime(syncStatus.lastSync.syncedAt)}
                      </span>
                      {syncStatus.lastSync.status === "error" && (
                        <span className="text-rose-400 ml-0.5">· error</span>
                      )}
                    </>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Github className="w-3 h-3" />
                      pulls from GitHub every 10m
                    </span>
                  )}
                </div>
              </div>

              {/* Tab switcher */}
              <div className="flex items-center p-1 bg-card/80 backdrop-blur-sm border border-border/80 rounded-lg shadow-sm">
                {(["by-level", "by-course"] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={cn(
                      "px-5 py-2 rounded-md text-sm font-semibold transition-all duration-200",
                      viewMode === mode
                        ? "bg-muted text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground/80 hover:bg-muted/50"
                    )}
                  >
                    {mode === "by-level" ? "By Level" : "By Course"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── By Level view ── */}
          {viewMode === "by-level" && (
            <div className="space-y-6">
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-24 rounded-xl bg-card/50 border border-border/50 animate-pulse" />
                  ))
                : filteredCards.map(({ track, level, lvlLabs, passed, total }) => {
                    const tm = TRACK_META[track] ?? { label: track, icon: Cpu, accentHex: "#94a3b8" }
                    const lm = LEVEL_META[level] ?? LEVEL_META[1]
                    const cardKey = `${track}-${level}`
                    const isOpen = !!expandedCards[cardKey]
                    const allPassed = passed === total && total > 0
                    const anyInProgress = lvlLabs.some(l => progressByLabId[l.id]?.status === "in_progress")

                    return (
                      <div key={cardKey} className={cn(
                        "rounded-xl border bg-card/80 backdrop-blur-sm overflow-hidden transition-all duration-300",
                        isOpen ? "border-border shadow-lg" : "border-border/50 hover:border-border"
                      )}>
                        {/* Card header row */}
                        <div
                          className="flex items-center gap-5 px-6 py-5 cursor-pointer hover:bg-muted/20 transition-colors"
                          onClick={() => toggleCard(cardKey)}
                        >
                          {/* Level Badge */}
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border"
                            style={{ background: `${lm.accentHex}10`, borderColor: `${lm.accentHex}30` }}
                          >
                            <span className="text-lg font-black font-mono" style={{ color: lm.accentHex }}>L{level}</span>
                          </div>

                          {/* Title */}
                          <div className="flex-1 min-w-0">
                            <p className="text-lg font-bold leading-tight flex items-center gap-2">
                              {lm.name}
                              {allPassed && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                            </p>
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground font-mono">
                              <span>{passed} / {total} Completed</span>
                              <span className="w-1 h-1 rounded-full bg-border" />
                              <span>{lvlLabs.reduce((acc, l) => acc + l.estimatedMinutes, 0)}m est.</span>
                            </div>
                          </div>

                          {/* Right: progress bar + chevron */}
                          <div className="flex items-center gap-6 shrink-0">
                            <div className="w-32 hidden md:block">
                              <Progress 
                                value={total > 0 ? (passed / total) * 100 : 0} 
                                className="h-2 bg-background border border-border" 
                                indicatorStyle={{ background: lm.accentHex }}
                              />
                            </div>
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center bg-background border transition-all duration-300",
                              isOpen ? "border-primary/50 text-primary" : "border-border text-muted-foreground"
                            )}>
                              <ChevronDown className={cn("w-4 h-4 transition-transform duration-300", isOpen && "rotate-180")} />
                            </div>
                          </div>
                        </div>

                        {/* Expanded lab rows */}
                        {isOpen && (
                          <div className="border-t border-border/50 bg-background/30 divide-y divide-border/40">
                            {lvlLabs.map((lab, idx) => {
                              const prog = progressByLabId[lab.id]
                              const isPassed     = prog?.status === "passed"
                              const isInProgress = prog?.status === "in_progress"
                              const score = prog?.bestScore ?? 0
                              
                              return (
                                <div key={lab.id} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/10 transition-colors group">
                                  {/* Row number */}
                                  <span className="w-6 text-right text-xs font-mono text-muted-foreground/50 shrink-0 select-none">
                                    {String(idx + 1).padStart(2, "0")}
                                  </span>

                                  {/* Status dot */}
                                  <div className="shrink-0">
                                    {isPassed
                                      ? <div className="w-5 h-5 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-green-500" /></div>
                                      : isInProgress
                                      ? <div className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center"><PlayCircle className="w-3 h-3 text-cyan-400" /></div>
                                      : <div className="w-5 h-5 rounded-full bg-background border border-muted-foreground/25 group-hover:border-primary/40 transition-colors" />
                                    }
                                  </div>

                                  {/* Title */}
                                  <span className="flex-1 min-w-0 text-sm font-medium text-foreground/85 group-hover:text-primary transition-colors truncate">
                                    {lab.title}
                                  </span>

                                  {/* Meta */}
                                  <span className="hidden sm:flex items-center gap-3 text-xs font-mono text-muted-foreground/50 shrink-0">
                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{lab.estimatedMinutes}m</span>
                                    {score > 0 && <span className="text-green-400/70">{score}%</span>}
                                  </span>

                                  {/* Action button */}
                                  <Link href={`/labs/${lab.id}`} className="shrink-0">
                                    <button className={cn(
                                      "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all duration-200",
                                      isPassed
                                        ? "bg-background border border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                                        : isInProgress
                                        ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25"
                                        : "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
                                    )}>
                                      {isPassed ? <><CheckCircle2 className="w-3 h-3" />Review</>
                                        : isInProgress ? <><PlayCircle className="w-3 h-3" />Continue</>
                                        : <><Terminal className="w-3 h-3" />Deploy</>}
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
            <div className="rounded-xl border border-border/50 bg-card/80 p-6 space-y-6">
              <div className="flex items-center gap-5">
                <Skeleton className="w-16 h-16 rounded-xl" />
                <div className="flex-1 space-y-3"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-72" /></div>
                <Skeleton className="w-28 h-10 rounded-lg" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[0,1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Course Header Card */}
              <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm overflow-hidden relative">
                <div className={cn("absolute inset-0 opacity-10 bg-gradient-to-r", meta.gradient)} />
                
                <div className="relative p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row gap-6 justify-between items-start sm:items-center">
                    <div className="flex items-center gap-5">
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 border"
                        style={{ background: `${meta.accentHex}15`, borderColor: `${meta.accentHex}30` }}
                      >
                        <meta.icon className="w-8 h-8" style={{ color: meta.accentHex }} />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">{meta.label} Bootcamp</h2>
                        <p className="text-muted-foreground mt-1 text-sm">{totalPassed} of {totalLabs} modules completed</p>
                      </div>
                    </div>

                    {nextLabId && (
                      <Link href={`/labs/${nextLabId}`}>
                        <button
                          className="w-full sm:w-auto px-8 py-3 rounded-xl text-sm font-bold transition-all shadow-[0_0_20px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                          style={{ background: meta.accentHex, color: "#000" }}
                        >
                          <PlayCircle className="w-5 h-5" />
                          {totalPassed > 0 ? "Resume Course" : "Start Course"}
                        </button>
                      </Link>
                    )}
                  </div>

                  {/* Progress milestones */}
                  <div className="mt-10 mb-2 px-2">
                    <div className="relative h-2.5 bg-background border border-border rounded-full flex items-center">
                      {/* Fill */}
                      {totalLabs > 0 && (
                        <div
                          className="absolute left-0 h-full rounded-full transition-all duration-1000 ease-out"
                          style={{
                            width: `${Math.max(2, (totalPassed / totalLabs) * 100)}%`,
                            background: `linear-gradient(90deg, ${meta.accentHex}40, ${meta.accentHex})`,
                          }}
                        />
                      )}
                      
                      {/* Markers */}
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
                                "w-6 h-6 rounded-full border-4 bg-card flex items-center justify-center transition-all z-10",
                                isComplete ? "border-transparent" : "border-background"
                              )}
                              style={isComplete ? { background: lm.accentHex } : {}}
                            >
                              {isComplete && <CheckCircle2 className="w-4 h-4 text-black" />}
                            </div>
                            <span className="absolute top-8 text-xs font-mono font-medium whitespace-nowrap text-muted-foreground">
                              {lm.name}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { count: trackStats.completed, label: "Verified", color: "#10b981", Icon: CheckCircle2 },
                  { count: trackStats.pending,   label: "In Progress", color: "#0ea5e9", Icon: Hourglass },
                  { count: trackStats.unlocked,  label: "Available", color: "#8b5cf6", Icon: Unlock },
                  { count: trackStats.locked,    label: "Locked", color: "#64748b", Icon: Lock },
                ].map(({ count, label, color, Icon }) => (
                  <div key={label} className="rounded-xl bg-card border border-border p-5 flex flex-col items-center justify-center text-center">
                    <Icon className="w-6 h-6 mb-3" style={{ color }} />
                    <span className="text-3xl font-black font-mono leading-none mb-1">{count}</span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
              
              {/* List of labs in course view */}
              <div className="space-y-4 pt-4">
                <h3 className="text-xl font-bold font-mono tracking-tight flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-primary" /> MODULES
                </h3>
                
                {levels.map(({ level, labs: lvlLabs, locked }) => {
                  const lm = LEVEL_META[level] ?? LEVEL_META[1]
                  
                  return (
                    <div key={level} className="space-y-3">
                      <h4 className="text-sm font-bold text-muted-foreground flex items-center gap-2 pt-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: lm.accentHex }} />
                        LEVEL {level}: {lm.name.toUpperCase()}
                      </h4>
                      
                      <div className="grid gap-3">
                        {lvlLabs.map((lab, idx) => {
                          const prog = progressByLabId[lab.id]
                          const isPassed = prog?.status === "passed"
                          
                          return (
                            <Link key={lab.id} href={`/labs/${lab.id}`}>
                              <div className="group flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/40 hover:bg-muted/20 transition-all cursor-pointer">
                                <div className="w-8 font-mono text-muted-foreground/50 text-right text-lg font-bold group-hover:text-primary/50 transition-colors">
                                  {(idx + 1).toString().padStart(2, '0')}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h5 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                                    {lab.title}
                                  </h5>
                                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                    {lab.estimatedMinutes}m • {lab.difficulty}
                                  </p>
                                </div>
                                <div>
                                  {isPassed ? (
                                    <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                                    </div>
                                  ) : (
                                    <div className="w-8 h-8 rounded-full border border-border group-hover:border-primary/50 flex items-center justify-center transition-colors">
                                      <PlayCircle className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
