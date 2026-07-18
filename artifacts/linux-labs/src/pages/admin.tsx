import { useState, useMemo } from "react"
import { Link } from "wouter"
import { useQuery } from "@tanstack/react-query"
import { useSession } from "@/lib/auth-client"
import { useListLabs } from "@workspace/api-client-react"
import {
  ArrowLeft, Users, BarChart3, ChevronDown, ChevronRight,
  Trophy, Medal, Crown, Terminal, Layers, Server, Container, GitBranch,
  Clock, CheckCircle2, Circle, ShieldAlert, Activity, XCircle, Loader2,
} from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { cn } from "@/lib/utils"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

const TRACK_META: Record<string, { label: string; accentClass: string; bgClass: string }> = {
  linux:     { label: "Linux",     accentClass: "text-cyan-400",   bgClass: "bg-cyan-400/10"   },
  terraform: { label: "Terraform", accentClass: "text-purple-400", bgClass: "bg-purple-400/10" },
  jenkins:   { label: "Jenkins",   accentClass: "text-orange-400", bgClass: "bg-orange-400/10" },
  docker:    { label: "Docker",    accentClass: "text-sky-400",    bgClass: "bg-sky-400/10"    },
  git:       { label: "Git",       accentClass: "text-red-400",    bgClass: "bg-red-400/10"    },
}

type SessionRow = {
  student_id: string
  lab_id: string
  status: string
  container_id: string | null
  updated_at: string
  name: string | null
  email: string | null
}

type StudentRow = {
  id: string
  name: string | null
  email: string | null
  passed: number
  attempted: number
  last_active: string | null
  labs: { labId: string; status: string; bestScore: number }[]
}

type CohortRow = {
  lab_id: string
  attempted: number
  passed: number
}

function displayName(s: StudentRow) {
  if (s.name) return s.name
  if (s.email) return s.email.split("@")[0]
  return `Guest ${s.id.slice(0, 8)}`
}

function displaySub(s: StudentRow) {
  if (s.name && s.email) return s.email
  if (!s.name && !s.email) return `ID: ${s.id.slice(0, 12)}…`
  return null
}

function relativeTime(iso: string | null) {
  if (!iso) return "never"
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

async function fetchAdmin<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (res.status === 403) throw Object.assign(new Error("Forbidden"), { status: 403 })
  if (!res.ok) throw new Error("Failed to fetch " + path)
  return res.json()
}

export default function AdminPage() {
  const { data: session, isPending } = useSession()
  const { data: labs } = useListLabs()
  const [tab, setTab] = useState<"leaderboard" | "cohort" | "sessions">("leaderboard")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const leaderboard = useQuery<StudentRow[]>({
    queryKey: ["admin", "leaderboard"],
    queryFn: () => fetchAdmin("/api/admin/leaderboard"),
    retry: false,
  })

  const cohort = useQuery<CohortRow[]>({
    queryKey: ["admin", "cohort"],
    queryFn: () => fetchAdmin("/api/admin/cohort"),
    retry: false,
    enabled: tab === "cohort",
  })

  const queryClient = useQueryClient()

  const sessions = useQuery<SessionRow[]>({
    queryKey: ["admin", "sessions"],
    queryFn: () => fetchAdmin("/api/admin/sessions"),
    retry: false,
    enabled: tab === "sessions",
    refetchInterval: tab === "sessions" ? 10_000 : false,
  })

  const killSession = useMutation({
    mutationFn: async ({ studentId, labId }: { studentId: string; labId: string }) => {
      const res = await fetch(`/api/admin/sessions/${encodeURIComponent(studentId)}/${encodeURIComponent(labId)}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to kill session")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "sessions"] }),
  })

  // Build lab lookup: id → { title, track }
  const labMeta = useMemo(() => {
    if (!labs) return {} as Record<string, { title: string; track: string }>
    return Object.fromEntries(labs.map((l) => [l.id, { title: l.title, track: l.track }]))
  }, [labs])

  // Per-track totals from labs list
  const trackTotals = useMemo(() => {
    if (!labs) return {} as Record<string, number>
    const m: Record<string, number> = {}
    for (const l of labs) m[l.track] = (m[l.track] ?? 0) + 1
    return m
  }, [labs])

  const totalLabs = labs?.length ?? 0

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Not logged in ────────────────────────────────────────────────────────────
  if (isPending) return null

  // ── 403 guard (shown from query error) ───────────────────────────────────────
  const is403 = (leaderboard.error as any)?.status === 403 ||
    (leaderboard.error as Error)?.message === "Forbidden"

  if (is403) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center space-y-3">
          <ShieldAlert className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="font-mono text-sm text-muted-foreground">
            {!session?.user
              ? "Sign in with an admin account to access this page."
              : "Your account doesn't have admin access."}
          </p>
          <Link href={`${basePath}/dashboard`} className="text-xs text-primary hover:underline">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  // ── Summary stats ─────────────────────────────────────────────────────────────
  const students = leaderboard.data ?? []
  const totalStudents = students.length
  const totalPassed = students.reduce((a, s) => a + s.passed, 0)
  const activeToday = students.filter((s) => {
    if (!s.last_active) return false
    return Date.now() - new Date(s.last_active).getTime() < 86400000
  }).length

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <header className="relative border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href={`${basePath}/dashboard`}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] tracking-widest uppercase px-2 py-0.5 rounded border border-amber-500/40 text-amber-400 bg-amber-500/10">
              Admin
            </span>
            <span className="font-mono font-bold text-sm">Instructor Panel</span>
          </div>
          <div className="w-24" />
        </div>
      </header>

      <div className="relative max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* ── Summary cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Students", value: totalStudents, icon: Users, color: "text-cyan-400" },
            { label: "Labs Completed", value: totalPassed, icon: CheckCircle2, color: "text-green-400" },
            { label: "Active Today", value: activeToday, icon: Clock, color: "text-amber-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border border-border/50 bg-card/50 p-5 flex items-center gap-4">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center bg-current/10", color)}>
                <Icon className={cn("w-5 h-5", color)} />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono leading-none">{leaderboard.isLoading ? "—" : value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 border-b border-border/50">
          {([
            { id: "leaderboard", label: "Leaderboard", icon: Trophy },
            { id: "cohort",      label: "Lab Stats",   icon: BarChart3 },
            { id: "sessions",    label: "Sessions",    icon: Activity },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Leaderboard tab ───────────────────────────────────────────────── */}
        {tab === "leaderboard" && (
          <div className="space-y-2">
            {leaderboard.isLoading && (
              <div className="text-center py-16 text-muted-foreground font-mono text-sm animate-pulse">
                Loading students…
              </div>
            )}
            {leaderboard.error && !is403 && (
              <div className="text-center py-16 text-red-400 font-mono text-sm">
                Failed to load data. Check that the API server is running.
              </div>
            )}
            {!leaderboard.isLoading && students.length === 0 && (
              <div className="text-center py-16 text-muted-foreground font-mono text-sm">
                No students yet.
              </div>
            )}
            {students.map((student, i) => {
              const rank = i + 1
              const isOpen = expanded.has(student.id)

              // Per-track passed counts
              const trackPassed: Record<string, number> = {}
              for (const l of student.labs) {
                if (l.status === "passed") {
                  const track = labMeta[l.labId]?.track
                  if (track) trackPassed[track] = (trackPassed[track] ?? 0) + 1
                }
              }

              const RankIcon =
                rank === 1 ? Crown :
                rank === 2 ? Medal :
                rank === 3 ? Trophy : null

              return (
                <div
                  key={student.id}
                  className="rounded-xl border border-border/50 bg-card/50 overflow-hidden"
                >
                  {/* Row */}
                  <button
                    onClick={() => toggleExpand(student.id)}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Rank */}
                    <div className={cn(
                      "w-8 text-center font-mono font-bold text-sm shrink-0",
                      rank === 1 ? "text-amber-400" :
                      rank === 2 ? "text-slate-300" :
                      rank === 3 ? "text-amber-600" : "text-muted-foreground",
                    )}>
                      {RankIcon ? <RankIcon className="w-5 h-5 mx-auto" /> : `#${rank}`}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{displayName(student)}</p>
                      {displaySub(student) && (
                        <p className="text-xs text-muted-foreground truncate">{displaySub(student)}</p>
                      )}
                    </div>

                    {/* Track mini-badges */}
                    <div className="hidden md:flex items-center gap-1.5">
                      {Object.keys(TRACK_META).filter(t => trackTotals[t]).map((track) => {
                        const meta = TRACK_META[track]
                        const done = trackPassed[track] ?? 0
                        const total = trackTotals[track] ?? 0
                        if (total === 0) return null
                        return (
                          <div key={track} className={cn("px-2 py-0.5 rounded text-[10px] font-mono", meta.bgClass, meta.accentClass)}>
                            {done}/{total}
                          </div>
                        )
                      })}
                    </div>

                    {/* Passed count */}
                    <div className="text-right shrink-0 w-24">
                      <p className="font-mono font-bold text-sm text-green-400">{student.passed}<span className="text-muted-foreground font-normal">/{totalLabs}</span></p>
                      <p className="text-[10px] text-muted-foreground">{relativeTime(student.last_active)}</p>
                    </div>

                    {/* Expand toggle */}
                    <div className="shrink-0 text-muted-foreground">
                      {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  </button>

                  {/* Expanded per-lab detail */}
                  {isOpen && (
                    <div className="border-t border-border/50 px-5 py-4 grid grid-cols-2 md:grid-cols-3 gap-2">
                      {student.labs.length === 0 ? (
                        <p className="col-span-3 text-xs text-muted-foreground font-mono">No lab attempts yet.</p>
                      ) : student.labs.map((l) => {
                        const meta = labMeta[l.labId]
                        const trackMeta = meta ? TRACK_META[meta.track] : null
                        return (
                          <div key={l.labId} className="flex items-center gap-2 text-xs">
                            {l.status === "passed"
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                              : <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                            <span className="truncate text-muted-foreground" title={meta?.title ?? l.labId}>
                              {meta?.title ?? l.labId}
                            </span>
                            {trackMeta && (
                              <span className={cn("shrink-0 text-[9px] font-mono", trackMeta.accentClass)}>
                                {trackMeta.label}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Cohort / Lab Stats tab ────────────────────────────────────────── */}
        {tab === "cohort" && (
          <div className="space-y-2">
            {cohort.isLoading && (
              <div className="text-center py-16 text-muted-foreground font-mono text-sm animate-pulse">
                Loading lab stats…
              </div>
            )}
            {cohort.data?.length === 0 && (
              <div className="text-center py-16 text-muted-foreground font-mono text-sm">
                No attempts recorded yet.
              </div>
            )}
            {/* Header */}
            {cohort.data && cohort.data.length > 0 && (
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-2 text-xs font-mono text-muted-foreground uppercase tracking-wide">
                <span>Lab</span>
                <span className="text-right w-20">Attempted</span>
                <span className="text-right w-16">Passed</span>
                <span className="text-right w-16">Rate</span>
              </div>
            )}
            {cohort.data?.map((row) => {
              const meta = labMeta[row.lab_id]
              const trackMeta = meta ? TRACK_META[meta.track] : null
              const rate = row.attempted > 0 ? Math.round((row.passed / row.attempted) * 100) : 0
              return (
                <div
                  key={row.lab_id}
                  className="rounded-xl border border-border/50 bg-card/50 px-5 py-4"
                >
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center">
                    {/* Lab name + track */}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{meta?.title ?? row.lab_id}</p>
                      {trackMeta && (
                        <span className={cn("text-[10px] font-mono", trackMeta.accentClass)}>
                          {trackMeta.label}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-sm text-right w-20">{row.attempted}</span>
                    <span className="font-mono text-sm text-right w-16 text-green-400">{row.passed}</span>
                    <div className="w-16 text-right">
                      <span className={cn(
                        "font-mono text-sm font-bold",
                        rate >= 80 ? "text-green-400" : rate >= 50 ? "text-amber-400" : "text-red-400",
                      )}>
                        {rate}%
                      </span>
                      {/* Mini bar */}
                      <div className="h-1 rounded-full bg-white/10 mt-1 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            rate >= 80 ? "bg-green-400" : rate >= 50 ? "bg-amber-400" : "bg-red-400",
                          )}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {/* ── Sessions tab ──────────────────────────────────────────────────── */}
        {tab === "sessions" && (
          <div className="space-y-2">
            {sessions.isLoading && (
              <div className="text-center py-16 text-muted-foreground font-mono text-sm animate-pulse">
                Loading sessions…
              </div>
            )}
            {sessions.error && (
              <div className="text-center py-16 text-red-400 font-mono text-sm">
                Failed to load sessions.
              </div>
            )}
            {!sessions.isLoading && sessions.data?.length === 0 && (
              <div className="text-center py-16 text-muted-foreground font-mono text-sm">
                No active sessions.
              </div>
            )}
            {sessions.data && sessions.data.length > 0 && (
              <>
                <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-5 py-2 text-xs font-mono text-muted-foreground uppercase tracking-wide">
                  <span>Student</span>
                  <span>Lab</span>
                  <span className="w-20 text-center">Status</span>
                  <span className="w-16" />
                </div>
                {sessions.data.map((s) => {
                  const labTitle = labMeta[s.lab_id]?.title ?? s.lab_id
                  const trackMeta = labMeta[s.lab_id] ? TRACK_META[labMeta[s.lab_id].track] : null
                  const studentLabel = s.name ?? s.email?.split("@")[0] ?? `Guest ${s.student_id.slice(0, 8)}`
                  const isKilling = killSession.isPending &&
                    (killSession.variables as any)?.studentId === s.student_id &&
                    (killSession.variables as any)?.labId === s.lab_id
                  return (
                    <div
                      key={`${s.student_id}:${s.lab_id}`}
                      className="rounded-xl border border-border/50 bg-card/50 px-5 py-3 grid grid-cols-[1fr_1fr_auto_auto] gap-4 items-center"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{studentLabel}</p>
                        {s.email && s.name && (
                          <p className="text-[10px] text-muted-foreground truncate">{s.email}</p>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm truncate">{labTitle}</p>
                        {trackMeta && (
                          <span className={cn("text-[10px] font-mono", trackMeta.accentClass)}>
                            {trackMeta.label}
                          </span>
                        )}
                      </div>
                      <div className="w-20 flex justify-center">
                        <span className={cn(
                          "text-[10px] font-mono px-2 py-0.5 rounded-full border",
                          s.status === "running"  ? "text-green-400 border-green-500/30 bg-green-500/10" :
                          s.status === "starting" ? "text-amber-400 border-amber-500/30 bg-amber-500/10" :
                                                    "text-red-400 border-red-500/30 bg-red-500/10",
                        )}>
                          {s.status}
                        </span>
                      </div>
                      <div className="w-16 flex justify-end">
                        <button
                          disabled={isKilling}
                          onClick={() => killSession.mutate({ studentId: s.student_id, labId: s.lab_id })}
                          className={cn(
                            "flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors",
                            "border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed",
                          )}
                          title="Force-kill this session"
                        >
                          {isKilling
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <XCircle className="w-3.5 h-3.5" />}
                          Kill
                        </button>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
