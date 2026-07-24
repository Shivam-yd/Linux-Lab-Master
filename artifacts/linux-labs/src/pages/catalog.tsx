import { useState, useMemo, useCallback, useEffect } from "react"
import { useMeta } from "@/hooks/use-meta"
import { useQuery } from "@tanstack/react-query"
import { Link, useLocation, useSearch, Redirect } from "wouter"
import { useListLabs, useListProgress } from "@workspace/api-client-react"
import { useSession } from "@/lib/auth-client"
import { usePlan, PRO_TRACKS } from "@/lib/use-plan"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Info, User, ChevronLeft, ShieldCheck } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { AccountDropdown } from "@/components/account-dropdown"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  Lock, CheckCircle2, PlayCircle,
  Clock, ChevronRight, Trophy, Star, Cpu, ChevronDown, ChevronUp,
  Award, Hourglass, Unlock, Zap, Server, RefreshCw, CloudDownload, Github,
  Terminal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { TRACK_META, DEFAULT_TRACK_META, type TrackMeta } from "@/lib/track-meta"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

// Sidebar footer — user identity row with About icon on the right.
function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { data: session } = useSession()
  const user = session?.user
  const name  = user?.name  || user?.email || "Guest"
  const email = user?.email || ""
  const initial = name.charAt(0).toUpperCase()

  return (
    <div className={cn("border-t border-border/50", collapsed ? "px-2 py-3" : "px-3 py-2.5")}>
      <div className={cn("flex items-center gap-2.5 min-w-0", collapsed && "justify-center")}>
        {/* Avatar */}
        <div className={cn(
          "shrink-0 w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold",
          user
            ? "bg-primary/15 border-primary/30 text-primary"
            : "bg-muted/50 border-border/60 text-muted-foreground"
        )}>
          {user ? initial : <User className="w-3.5 h-3.5" />}
        </div>
        {/* Name / email */}
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-muted-foreground truncate leading-tight">
              {user ? name : "Guest"}
            </p>
            <p className="text-[10px] text-muted-foreground/45 truncate leading-none mt-0.5">
              {user ? email : "Progress saved by cookie"}
            </p>
          </div>
        )}
        {/* About icon — right side of the row */}
        {!collapsed && (
          <Link href="/about" title="About" className="shrink-0 p-1 rounded-md text-primary/60 hover:text-primary hover:bg-primary/10 transition-colors">
            <Info className="w-4 h-4" />
          </Link>
        )}
      </div>
    </div>
  )
}

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
  const res = await fetch("/api/labs/sync/status", { credentials: "include" })
  if (!res.ok) throw new Error("Failed to fetch sync status")
  return res.json()
}

async function triggerSync(): Promise<void> {
  await fetch("/api/labs/sync", { method: "POST", credentials: "include" })
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
  const { data: session } = useSession()
  const loading = labsLoading || progressLoading

  // ── GitHub sync state ──────────────────────────────────────────────────────
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchSyncStatus().then(setSyncStatus).catch(() => {})
  }, [])

  // Guest progress claim toast — cookie set by requireAuth middleware when migration happened
  const { toast } = useToast()
  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)_guest_claimed=(\d+)/)
    if (match) {
      const count = parseInt(match[1], 10)
      toast({
        title: "Progress saved to your account",
        description: `${count} lab${count !== 1 ? "s" : ""} from your guest session have been linked to your account.`,
      })
      document.cookie = "_guest_claimed=; Max-Age=0; path=/"
    }
  }, [])

  const handleFetchLabs = useCallback(async () => {
    setSyncing(true)
    setSyncMessage(null)
    const beforeSyncedAt = syncStatus?.lastSync?.syncedAt ?? null
    try {
      await triggerSync()
      // Poll until syncedAt changes (sync completed) or 90s timeout
      let fresh = syncStatus
      for (let i = 0; i < 45; i++) {
        await new Promise(r => setTimeout(r, 2000))
        fresh = await fetchSyncStatus().catch(() => fresh)
        if (fresh?.lastSync?.syncedAt !== beforeSyncedAt) break
      }
      setSyncStatus(fresh)
      if (fresh?.lastSync?.status === "error") {
        setSyncMessage("✗ Sync failed — check network or repo")
      } else {
        const added   = fresh?.lastSync?.labsAdded   ?? 0
        const updated = fresh?.lastSync?.labsUpdated ?? 0
        if (added === 0 && updated === 0) {
          setSyncMessage("Already up to date")
        } else {
          const parts = []
          if (added   > 0) parts.push(`${added} new`)
          if (updated > 0) parts.push(`${updated} updated`)
          setSyncMessage(`✓ ${parts.join(", ")} lab${(added + updated) !== 1 ? "s" : ""} synced`)
        }
      }
      await refetchLabs()
      await refetchProgress()
    } catch {
      setSyncMessage("✗ Sync failed — check network or repo")
    } finally {
      setSyncing(false)
    }
  }, [syncStatus, refetchLabs, refetchProgress])

  // Derive sorted unique tracks that have labs, plus coming-soon tracks
  const tracks = useMemo(() => {
    const order = ["linux", "terraform", "jenkins", "docker", "git", "kubernetes", "ansible"]
    const seen = new Set<string>(labs?.map(l => l.track) ?? [])
    order.forEach(t => {
      if (TRACK_META[t]?.comingSoon) seen.add(t)
    })
    return order.filter(t => seen.has(t))
  }, [labs])

  const search = useSearch()
  const trackFromUrl = useMemo(() => new URLSearchParams(search).get("track") ?? "", [search])
  const [activeTrack, setActiveTrack] = useState<string>(trackFromUrl || "linux")
  const [, navigate] = useLocation()

  // Keep local state in sync if the URL's track param changes externally
  // (e.g. the user navigates via browser back/forward, or a Workspace "Back" link).
  useEffect(() => {
    if (trackFromUrl && trackFromUrl !== activeTrack) {
      setActiveTrack(trackFromUrl)
    }
  }, [trackFromUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ensure activeTrack stays valid once data loads
  const resolvedTrack = tracks.includes(activeTrack) ? activeTrack : (tracks[0] ?? "linux")
  const trackLabel = (TRACK_META[resolvedTrack] ?? DEFAULT_TRACK_META).label
  useMeta(`${trackLabel} Labs — DevLabMaster`)

  const handleTrackChange = (track: string) => {
    setActiveTrack(track)
    navigate(`/dashboard?track=${encodeURIComponent(track)}`, { replace: true })
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

  // Overall completion summary across every track (not just the active one)
  const overallStats = useMemo(() => {
    if (!labs || !progress) return { passed: 0, total: 0 }
    const passed = labs.filter(l => progressByLabId[l.id]?.status === "passed").length
    return { passed, total: labs.length }
  }, [labs, progress, progressByLabId])
  const overallPct = overallStats.total > 0 ? Math.round((overallStats.passed / overallStats.total) * 100) : 0

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

  const meta: TrackMeta = TRACK_META[resolvedTrack] ?? {
    ...DEFAULT_TRACK_META,
    label: resolvedTrack,
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

  const { plan, hasSubscription, isLoading: planLoading } = usePlan()
  // Derived once; used by upgrade wall, view gates, and lab-button lock.
  // !planLoading prevents flashing "locked" for devops-pro users while plan resolves.
  const isTrackLocked = !planLoading && PRO_TRACKS.has(resolvedTrack) && plan === "linux-starter"
  const [lockedLab, setLockedLab] = useState<string | null>(null)

  const { data: adminCheck } = useQuery({
    queryKey: ["admin-check"],
    queryFn: () => fetch(`${basePath}/api/admin/check`).then(r => r.json()) as Promise<{ isAdmin: boolean }>,
    staleTime: Infinity,
  })

  const [expanded, setExpanded] = useState(true)

  // Sidebar collapsed state — persisted across page loads
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "true" } catch { return false }
  })
  const toggleSidebar = () => setCollapsed(v => {
    const next = !v
    try { localStorage.setItem("sidebar-collapsed", String(next)) } catch {}
    return next
  })

  // View mode — persisted across refreshes
  const [viewMode, setViewMode] = useState<"by-level" | "by-course">(() => {
    try { return (localStorage.getItem("catalog-view-mode") as "by-level" | "by-course") ?? "by-level" } catch { return "by-level" }
  })
  const setViewModePersisted = (mode: "by-level" | "by-course") => {
    try { localStorage.setItem("catalog-view-mode", mode) } catch {}
    setViewMode(mode)
  }

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

  // Default expand first card — must be useEffect, not useMemo (no side effects in memo)
  useEffect(() => {
    if (filteredCards.length > 0 && Object.keys(expandedCards).length === 0) {
      const defaults: Record<string, boolean> = {
        [`${filteredCards[0].track}-${filteredCards[0].level}`]: true,
      }
      if (levels.length > 0) defaults[`course-${resolvedTrack}-${levels[0].level}`] = true
      setExpandedCards(defaults)
    }
  }, [filteredCards]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: authSession, isPending: authPending } = useSession()
  if (!authPending && !planLoading && authSession?.user && !hasSubscription) {
    return <Redirect to="/choose-plan" />
  }

  return (
    <div className="relative flex h-screen bg-background text-foreground overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className={cn(
        "shrink-0 flex flex-col bg-card border-r border-border relative z-10 transition-[width] duration-200 overflow-hidden",
        collapsed ? "w-16" : "w-64"
      )}>
        {/* Brand */}
        <div className={cn("border-b border-border/50 relative overflow-hidden", collapsed ? "px-2 py-[18px]" : "px-5 py-[18px]")}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[50px] -mr-10 -mt-10" />
          <Link href="/" className={cn("relative z-10 flex items-center gap-3 hover:opacity-80 transition-opacity", collapsed && "justify-center")}>
            <img src="/logo.svg" className="w-9 h-9 rounded-xl shrink-0" />
            {!collapsed && (
              <div>
                <p className="text-[15px] font-bold leading-none tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">DevLabMaster</p>
              </div>
            )}
          </Link>
        </div>

        {/* Overall completion summary */}
        <div className={cn("pt-4", collapsed ? "px-2" : "px-4")}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-1 rounded-xl border border-border/70 bg-muted/20 py-3">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-black font-mono text-foreground leading-none">
                {loading ? "…" : overallStats.passed}
              </span>
            </div>
          ) : (
            <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Overall</span>
                </div>
                {overallStats.total > 0 && overallStats.passed === overallStats.total && (
                  <Award className="w-4 h-4 text-amber-400" />
                )}
              </div>
              <p className="mt-2 text-lg font-black font-mono leading-none">
                {loading ? "…" : `${overallStats.passed}/${overallStats.total}`}
                <span className="text-xs font-semibold text-muted-foreground ml-1.5">labs completed</span>
              </p>
              <Progress value={overallPct} className="h-1.5 mt-2.5 bg-background border border-border/50" />
            </div>
          )}
        </div>

        {/* Track list + level dropdowns */}
        <nav className={cn("flex-1 min-h-0 overflow-y-auto py-4 flex flex-col gap-1", collapsed ? "px-2" : "px-3")}>
          {!collapsed && (
            <p className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
              Tracks
            </p>
          )}
          <div className="flex-1 space-y-1">
            {loading
              ? Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className={cn("rounded-xl bg-muted/30 animate-pulse", collapsed ? "h-10 mx-1" : "h-16 mx-1")} />
                ))
              : tracks.map(track => {
                  const tm = TRACK_META[track]
                  const Icon = tm?.icon ?? Server
                  const isActive = track === resolvedTrack
                  const sum = trackSummary[track]
                  const pct = sum?.total ? Math.round((sum.passed / sum.total) * 100) : 0
                  const trackComplete = !!sum && sum.total > 0 && sum.passed === sum.total

                  return (
                    <button
                      key={track}
                      onClick={() => handleTrackChange(track)}
                      title={collapsed ? (tm?.label ?? track) : undefined}
                      className={cn(
                        "w-full flex flex-col gap-2 rounded-xl text-left transition-all duration-200 group relative overflow-hidden",
                        collapsed ? "px-0 py-2 items-center justify-center" : "px-3 py-3",
                        isActive
                          ? "bg-primary/10 border border-primary/25 shadow-sm"
                          : "hover:bg-primary/5 border border-transparent"
                      )}
                    >
                      <div className={cn("flex items-center w-full relative z-10", collapsed ? "justify-center" : "gap-3")}>
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                          isActive ? "bg-primary/10 border border-primary/20" : "bg-muted/50 group-hover:bg-muted"
                        )}>
                          <Icon className={cn("w-4 h-4", isActive ? tm?.accentClass : "text-muted-foreground")} />
                        </div>
                        {!collapsed && (
                          <>
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-sm font-semibold leading-tight flex items-center gap-1.5",
                                isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground/90"
                              )}>
                                {tm?.label ?? track}
                                {trackComplete && <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                                {PRO_TRACKS.has(track) && plan === "linux-starter" && (
                                  <Lock className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                                )}
                              </p>
                              {sum && (
                                <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                                  {sum.passed}/{sum.total} Labs
                                </p>
                              )}
                            </div>
                            <ChevronRight className={cn("w-4 h-4 shrink-0 transition-transform", isActive ? "text-primary translate-x-1" : "text-muted-foreground/40")} />
                          </>
                        )}
                      </div>

                      {!collapsed && sum && isActive && (
                        <div className="w-full pl-11 pr-2 relative z-10">
                          <Progress value={pct} className="h-1.5 bg-background border border-border/50" />
                        </div>
                      )}
                    </button>
                  )
                })}
          </div>

        </nav>

        {/* About link */}
        <div className={cn("border-t border-border/50 py-2", collapsed ? "px-2" : "px-3")}>
          <Link
            href="/about"
            title="About"
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground/70 hover:text-foreground hover:bg-primary/5 transition-colors",
              collapsed && "justify-center"
            )}
          >
            <Info className="w-3.5 h-3.5 shrink-0" />
            {!collapsed && <span>About</span>}
          </Link>
        </div>

        {/* Footer — identity */}
        <UserMenu collapsed={collapsed} />
      </aside>

      {/* ── Sidebar collapse toggle — floats on the sidebar/content boundary ── */}
      <button
        onClick={toggleSidebar}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        style={{
          left: collapsed ? "64px" : "256px",
          transition: "left 200ms ease",
        }}
        className="absolute top-[22px] -translate-x-1/2 z-20 w-[22px] h-[22px] rounded-full bg-card border border-border/80 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 hover:shadow-[0_0_10px_rgba(45,212,191,0.2)] shadow-sm transition-colors duration-150"
      >
        <ChevronLeft
          className="w-3 h-3 transition-transform duration-200"
          style={{ transform: collapsed ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {/* ── Main content ────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-background/50 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
        
        <div className="p-8 max-w-6xl mx-auto space-y-8 relative z-10">

          {/* Admin banner */}
          {adminCheck?.isAdmin && (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-card/60 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-foreground">Admin</span>
                  <span className="text-xs text-muted-foreground">You have elevated access to this platform.</span>
                </div>
              </div>
              <Link
                href={`${basePath}/admin`}
                className="text-xs font-semibold text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/15 border border-primary/20 rounded-lg px-3 py-1.5 transition-colors shrink-0"
              >
                Admin Panel →
              </Link>
            </div>
          )}

          {/* Header Area */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border/40">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                {meta.label} Range
              </h1>
              <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-relaxed">
                {meta.description}
              </p>
              {trackStats.total > 0 && trackStats.completed === trackStats.total && (
                <Link href={`${basePath}/certificate/${resolvedTrack}`}>
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors cursor-pointer">
                    <Award className="w-3.5 h-3.5 shrink-0" />
                    Track Complete — View Certificate
                  </div>
                </Link>
              )}
            </div>

            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-2">
                {/* Fetch Labs icon button */}
                <button
                  onClick={handleFetchLabs}
                  disabled={syncing}
                  title={syncing ? "Fetching…" : "Fetch Labs"}
                  className={cn(
                    "w-9 h-9 flex items-center justify-center rounded-lg border transition-all duration-200",
                    syncing
                      ? "bg-muted/40 border-border text-muted-foreground cursor-not-allowed"
                      : "bg-card border-border hover:border-primary/50 hover:bg-muted/30 text-foreground"
                  )}
                >
                  {syncing
                    ? <RefreshCw className="w-4 h-4 animate-spin" />
                    : <CloudDownload className="w-4 h-4" />
                  }
                </button>

                {/* Tab switcher */}
                <div className="flex items-center p-1 bg-card/80 backdrop-blur-sm border border-border/80 rounded-lg shadow-sm">
                  {(["by-level", "by-course"] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setViewModePersisted(mode)}
                      className={cn(
                        "px-4 py-1.5 rounded-md text-sm font-semibold transition-all duration-200 whitespace-nowrap",
                        viewMode === mode
                          ? "bg-muted text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground/80 hover:bg-muted/50"
                      )}
                    >
                      {mode === "by-level" ? "By Level" : "By Course"}
                    </button>
                  ))}
                </div>

                {/* Account dropdown */}
                <ThemeToggle />
                <AccountDropdown />
              </div>

              {/* Status line */}
              <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground/70">
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
          </div>

          {/* ── Pro track upgrade wall ── */}
          {isTrackLocked && (
            <div className="rounded-2xl border border-primary/20 bg-card/80 backdrop-blur-sm p-12 text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                <Lock className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">DevOps Pro Required</p>
                <h2 className="text-2xl font-bold">This track is locked</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">
                  The <span className="font-semibold text-foreground">{meta.label}</span> track is included in the DevOps Pro plan.
                  Upgrade to unlock all 5 tracks — Docker, Terraform, Jenkins, Git, and Linux.
                </p>
              </div>
              <Link
                href={`${basePath}/pricing`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                <Zap className="w-4 h-4" />
                Upgrade to DevOps Pro
              </Link>
            </div>
          )}

          {/* Coming soon placeholder for empty tracks */}
          {totalLabs === 0 && !isTrackLocked && (
            <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-10 text-center space-y-4">
              <div
                className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center border"
                style={{ background: `${meta.accentHex}15`, borderColor: `${meta.accentHex}30` }}
              >
                <meta.icon className="w-8 h-8" style={{ color: meta.accentHex }} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{meta.label} — Coming Soon</h2>
                <p className="text-muted-foreground mt-2 max-w-md mx-auto">{meta.description}</p>
              </div>
            </div>
          )}

          {/* ── By Level view ── */}
          {viewMode === "by-level" && totalLabs > 0 && !isTrackLocked && (
            <div className="space-y-6">
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-24 rounded-xl bg-card/50 border border-border/50 animate-pulse" />
                  ))
                : filteredCards.map(({ track, level, lvlLabs, passed, total }) => {
                    const tm = TRACK_META[track] ?? { ...DEFAULT_TRACK_META, label: track }
                    const lm = LEVEL_META[level] ?? LEVEL_META[1]
                    const cardKey = `${track}-${level}`
                    const isOpen = !!expandedCards[cardKey]
                    const allPassed = passed === total && total > 0
                    const anyInProgress = lvlLabs.some(l => progressByLabId[l.id]?.status === "in_progress")

                    return (
                      <div key={cardKey} className={cn(
                        "rounded-xl border bg-card overflow-hidden transition-all duration-300 shadow-sm",
                        isOpen ? "border-border shadow-md" : "border-border/60 hover:border-border"
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
                              {allPassed && (
                                <Link href={`${basePath}/certificate/${track}/level/${level}`} onClick={e => e.stopPropagation()}>
                                  <span className="flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors">
                                    <Award className="w-3 h-3" />View Certificate
                                  </span>
                                </Link>
                              )}
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
                                  {PRO_TRACKS.has(lab.track) && plan === "linux-starter" ? (
                                    <button onClick={() => setLockedLab(lab.title)} className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-primary/5 border border-primary/20 text-primary/60 hover:bg-primary/10 hover:text-primary transition-all duration-200">
                                      <Lock className="w-3 h-3" />Pro
                                    </button>
                                  ) : (
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
                                          : <><Terminal className="w-3 h-3" />Start</>}
                                      </button>
                                    </Link>
                                  )}
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
          {viewMode === "by-course" && !isTrackLocked && (loading ? (
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
              <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm overflow-hidden relative">
                <div className={cn("absolute inset-0 opacity-10 bg-gradient-to-r", meta.gradient)} />
                <div className="relative px-5 py-4 flex items-center gap-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                    style={{ background: `${meta.accentHex}15`, borderColor: `${meta.accentHex}30` }}
                  >
                    <meta.icon className="w-5 h-5" style={{ color: meta.accentHex }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold leading-tight">{meta.label} Bootcamp</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{totalPassed} of {totalLabs} modules completed</p>
                  </div>
                  {/* Stats pills */}
                  <div className="hidden sm:flex items-center gap-2 text-xs font-mono">
                    {[
                      { count: trackStats.completed, label: "done",     color: "#10b981" },
                      { count: trackStats.pending,   label: "active",   color: "#0ea5e9" },
                      { count: trackStats.unlocked,  label: "open",     color: "#8b5cf6" },
                    ].map(({ count, label, color }) => (
                      <span key={label} className="px-2 py-1 rounded-md border border-border bg-background/50 text-muted-foreground">
                        <span className="font-bold" style={{ color }}>{count}</span> {label}
                      </span>
                    ))}
                  </div>
                  {nextLabId && (
                    <Link href={`/labs/${nextLabId}`}>
                      <button
                        className="shrink-0 px-4 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-90 active:scale-95 flex items-center gap-1.5"
                        style={{ background: meta.accentHex, color: "#000" }}
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        {totalPassed > 0 ? "Resume" : "Start"}
                      </button>
                    </Link>
                  )}
                </div>
                {/* Slim progress bar */}
                <div className="px-5 pb-8 mt-1">
                  <div className="relative h-1.5 bg-background border border-border/60 rounded-full">
                    {totalLabs > 0 && (
                      <div
                        className="absolute left-0 h-full rounded-full transition-all duration-1000 ease-out"
                        style={{
                          width: `${Math.max(2, (totalPassed / totalLabs) * 100)}%`,
                          background: `linear-gradient(90deg, ${meta.accentHex}60, ${meta.accentHex})`,
                        }}
                      />
                    )}
                    {milestones.map(({ level, cumTotal }) => {
                      const pos = totalLabs > 0 ? (cumTotal / totalLabs) * 100 : 0
                      const lm = LEVEL_META[level] ?? LEVEL_META[1]
                      const isComplete = totalPassed >= cumTotal
                      return (
                        <div key={level} className="absolute flex flex-col items-center -translate-x-1/2 -top-0.5" style={{ left: `${pos}%` }}>
                          <div className="w-2.5 h-2.5 rounded-full border-2 border-background transition-all" style={{ background: isComplete ? lm.accentHex : "#334155" }} />
                          <span className="absolute top-4 text-[10px] font-mono text-muted-foreground/60 whitespace-nowrap">{lm.name}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              
              {/* List of labs in course view */}
              <div className="space-y-4 pt-4">
                <h3 className="text-xl font-bold font-mono tracking-tight flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-primary" /> MODULES
                </h3>
                
                {levels.map(({ level, labs: lvlLabs }) => {
                  const lm = LEVEL_META[level] ?? LEVEL_META[1]
                  const courseKey = `course-${resolvedTrack}-${level}`
                  const isCourseOpen = !!expandedCards[courseKey]
                  const lvlPassed = lvlLabs.filter(l => progressByLabId[l.id]?.status === "passed").length

                  return (
                    <div key={level} className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
                      <button
                        onClick={() => toggleCard(courseKey)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors text-left"
                      >
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: lm.accentHex }} />
                        <span className="text-sm font-bold text-muted-foreground flex-1">
                          LEVEL {level}: {lm.name.toUpperCase()}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground/50 mr-2">
                          {lvlPassed}/{lvlLabs.length}
                        </span>
                        <ChevronDown className={cn("w-4 h-4 text-muted-foreground/50 transition-transform duration-200", isCourseOpen && "rotate-180")} />
                      </button>

                      {isCourseOpen && (
                      <div className="grid gap-3 border-t border-border/40 bg-background/30 p-3">
                        {lvlLabs.map((lab, idx) => {
                          const prog = progressByLabId[lab.id]
                          const isPassed = prog?.status === "passed"
                          
                          return (
                            <Link
                              key={lab.id}
                              href={`/labs/${lab.id}`}
                              onClick={e => {
                                if (PRO_TRACKS.has(lab.track) && plan === "linux-starter") {
                                  e.preventDefault()
                                  setLockedLab(lab.title)
                                }
                              }}
                            >
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
                      )}
                    </div>
                  )
                })}
              </div>

            </div>
          ))}
        </div>
      </div>
      <Dialog open={!!lockedLab} onOpenChange={open => !open && setLockedLab(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade to DevOps Pro to access this lab</DialogTitle>
            <DialogDescription>
              {lockedLab} is part of the DevOps Pro plan. Unlock Docker, Terraform, Jenkins, and Git labs with one upgrade.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Link href={`${basePath}/pricing`} onClick={() => setLockedLab(null)} className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
              Upgrade to DevOps Pro
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
