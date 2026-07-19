import { useState, useMemo, useEffect } from "react"
import { Link } from "wouter"
import { useQuery } from "@tanstack/react-query"
import { useSession } from "@/lib/auth-client"
import { useListLabs } from "@workspace/api-client-react"
import {
  ArrowLeft, Users, BarChart3, ChevronRight,
  Trophy, Medal, Crown, Terminal, Layers, Server, Container, GitBranch,
  CheckCircle2, Circle, ShieldAlert, Activity, XCircle, Loader2, RotateCcw,
  KeyRound, Trash2, UserX, X, TrendingUp, Zap, Target,
} from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

const TRACK_META: Record<string, { label: string; accentClass: string; accentHex: string; bgClass: string; icon: React.ElementType }> = {
  linux:     { label: "Linux",     accentClass: "text-cyan-400",   accentHex: "#22d3ee", bgClass: "bg-cyan-400/10",   icon: Terminal  },
  terraform: { label: "Terraform", accentClass: "text-purple-400", accentHex: "#c084fc", bgClass: "bg-purple-400/10", icon: Layers    },
  jenkins:   { label: "Jenkins",   accentClass: "text-orange-400", accentHex: "#f97316", bgClass: "bg-orange-400/10", icon: Server    },
  docker:    { label: "Docker",    accentClass: "text-sky-400",    accentHex: "#38bdf8", bgClass: "bg-sky-400/10",    icon: Container },
  git:       { label: "Git",       accentClass: "text-red-400",    accentHex: "#f87171", bgClass: "bg-red-400/10",    icon: GitBranch },
}

type PasswordResetRequest = {
  id: number
  userId: string
  email: string
  status: "pending" | "approved" | "used"
  resetToken: string | null
  requestedAt: string
  approvedAt: string | null
  expiresAt: string | null
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

function getInitial(s: StudentRow) {
  return (s.name || s.email || "G").charAt(0).toUpperCase()
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
  const [tab, setTab] = useState<"leaderboard" | "cohort" | "sessions" | "password-resets">("leaderboard")
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null)
  const [confirmReset, setConfirmReset] = useState<StudentRow | null>(null)
  const [confirmDeleteReset, setConfirmDeleteReset] = useState<PasswordResetRequest | null>(null)
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState<StudentRow | null>(null)
  const [deleteAccountEmail, setDeleteAccountEmail] = useState("")
  const { toast } = useToast()

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

  const pwResets = useQuery<PasswordResetRequest[]>({
    queryKey: ["admin", "password-resets"],
    queryFn: () => fetchAdmin("/api/admin/password-reset-requests"),
    retry: false,
    enabled: tab === "password-resets",
    refetchInterval: tab === "password-resets" ? 15_000 : false,
  })

  const approvePwReset = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/password-reset-requests/${id}/approve`, { method: "POST" })
      if (!res.ok) throw new Error("Failed to approve request")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "password-resets"] }),
  })

  const dismissPwReset = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/password-reset-requests/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to dismiss request")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "password-resets"] }),
  })

  const killSession = useMutation({
    mutationFn: async ({ studentId, labId }: { studentId: string; labId: string }) => {
      const res = await fetch(`/api/admin/sessions/${encodeURIComponent(studentId)}/${encodeURIComponent(labId)}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to kill session")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "sessions"] }),
  })

  const resetProgress = useMutation({
    mutationFn: async (studentId: string) => {
      const res = await fetch(`/api/admin/progress/${encodeURIComponent(studentId)}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to reset progress")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "leaderboard"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "sessions"] })
    },
  })

  const deleteAccount = useMutation({
    mutationFn: async (studentId: string) => {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(studentId)}`, { method: "DELETE" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Failed to delete account")
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "leaderboard"] }),
    onError: (err: Error) => toast({ title: "Cannot delete account", description: err.message, variant: "destructive" }),
  })

  const labMeta = useMemo(() => {
    if (!labs) return {} as Record<string, { title: string; track: string }>
    return Object.fromEntries(labs.map((l: any) => [l.id, { title: l.title, track: l.track }]))
  }, [labs])

  const trackTotals = useMemo(() => {
    if (!labs) return {} as Record<string, number>
    const m: Record<string, number> = {}
    for (const l of labs as any[]) m[l.track] = (m[l.track] ?? 0) + 1
    return m
  }, [labs])

  const totalLabs = labs?.length ?? 0

  // Keep selectedStudent in sync with fresh leaderboard data.
  // After a reset the panel auto-updates; after a delete it auto-closes.
  useEffect(() => {
    if (!selectedStudent || !leaderboard.data) return
    const fresh = leaderboard.data.find((s: StudentRow) => s.id === selectedStudent.id)
    if (fresh) setSelectedStudent(fresh)
    else setSelectedStudent(null)
  }, [leaderboard.data]) // eslint-disable-line react-hooks/exhaustive-deps

  if (isPending) return null

  const is403 = (leaderboard.error as any)?.status === 403 ||
    (leaderboard.error as Error)?.message === "Forbidden"

  if (is403) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-muted/30 border border-border flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Access restricted</p>
            <p className="text-sm text-muted-foreground mt-1">
              {!session?.user ? "Sign in with an admin account to continue." : "Your account doesn't have admin access."}
            </p>
          </div>
          <Link href={`${basePath}/dashboard`} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  const students = leaderboard.data ?? []
  const totalStudents = students.length
  const totalPassed = students.reduce((a: number, s: StudentRow) => a + s.passed, 0)
  const activeToday = students.filter((s: StudentRow) => {
    if (!s.last_active) return false
    return Date.now() - new Date(s.last_active).getTime() < 86400000
  }).length

  const sliderPassRate = selectedStudent && selectedStudent.attempted > 0
    ? Math.round((selectedStudent.passed / selectedStudent.attempted) * 100) : 0
  const sliderPassedLabs = selectedStudent?.labs.filter(l => l.status === "passed") ?? []
  const sliderAvgScore = sliderPassedLabs.length > 0
    ? Math.round(sliderPassedLabs.reduce((a, l) => a + l.bestScore, 0) / sliderPassedLabs.length) : 0

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">

      {/* Header */}
      <header className="shrink-0 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="px-6 h-14 flex items-center justify-between">
          <Link
            href={`${basePath}/dashboard`}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="font-bold text-sm tracking-tight">Instructor Panel</span>
            <span className="font-mono text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-md border border-amber-500/30 text-amber-400 bg-amber-500/10">
              Admin
            </span>
          </div>
          <div className="w-28" />
        </div>
      </header>

      {/* ── Split pane body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Main scrollable area ── */}
        <div className="flex-1 overflow-y-auto min-w-0">
          <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Total Students", value: totalStudents, sub: "registered accounts",  icon: Users,       color: "text-cyan-400",  bg: "bg-cyan-400/10",  border: "border-cyan-400/20"  },
                { label: "Labs Completed", value: totalPassed,   sub: "across all students",  icon: CheckCircle2,color: "text-green-400", bg: "bg-green-400/10", border: "border-green-400/20" },
                { label: "Active Today",   value: activeToday,   sub: "in the last 24 hours", icon: TrendingUp,  color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20" },
              ].map(({ label, value, sub, icon: Icon, color, bg, border }) => (
                <div key={label} className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
                    <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center border", bg, border)}>
                      <Icon className={cn("w-4 h-4", color)} />
                    </div>
                  </div>
                  <div>
                    <p className={cn("text-3xl font-black font-mono leading-none", leaderboard.isLoading ? "text-muted-foreground/30" : "text-foreground")}>
                      {leaderboard.isLoading ? "—" : value}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-xl bg-muted/30 border border-border/50 w-fit">
              {([
                { id: "leaderboard",     label: "Leaderboard",    icon: Trophy    },
                { id: "cohort",          label: "Lab Stats",       icon: BarChart3 },
                { id: "sessions",        label: "Sessions",        icon: Activity  },
                { id: "password-resets", label: "Password Resets", icon: KeyRound  },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-150",
                    tab === id
                      ? "bg-card border border-border/60 text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* ── Leaderboard ── */}
            {tab === "leaderboard" && (
              <div className="space-y-2">
                {leaderboard.isLoading && (
                  <div className="text-center py-20 text-muted-foreground font-mono text-sm animate-pulse">Loading students…</div>
                )}
                {leaderboard.error && (
                  <div className="text-center py-20 text-red-400 font-mono text-sm">Failed to load data. Check that the API server is running.</div>
                )}
                {!leaderboard.isLoading && students.length === 0 && (
                  <div className="text-center py-20 space-y-2">
                    <Users className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                    <p className="text-muted-foreground text-sm">No students yet.</p>
                  </div>
                )}
                {students.length > 0 && (
                  <div className="grid grid-cols-[2rem_1fr_auto_auto_1.5rem] gap-4 px-5 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <span>#</span><span>Student</span>
                    <span className="hidden md:block">Track Progress</span>
                    <span className="text-right">Labs</span><span />
                  </div>
                )}
                {students.map((student, i) => {
                  const rank = i + 1
                  const trackPassed: Record<string, number> = {}
                  for (const l of student.labs) {
                    if (l.status === "passed") {
                      const track = labMeta[l.labId]?.track
                      if (track) trackPassed[track] = (trackPassed[track] ?? 0) + 1
                    }
                  }
                  const pct = totalLabs > 0 ? Math.round((student.passed / totalLabs) * 100) : 0
                  const RankIcon = rank === 1 ? Crown : rank === 2 ? Medal : rank === 3 ? Trophy : null
                  const rankColor = rank === 1 ? "text-amber-400" : rank === 2 ? "text-slate-300" : rank === 3 ? "text-amber-700" : "text-muted-foreground"
                  const isSelected = selectedStudent?.id === student.id

                  return (
                    <button
                      key={student.id}
                      onClick={() => setSelectedStudent(isSelected ? null : student)}
                      className={cn(
                        "w-full rounded-xl border bg-card/60 hover:bg-card transition-all duration-150 group",
                        isSelected ? "border-primary/40 bg-card shadow-sm" : "border-border/50 hover:border-border",
                      )}
                    >
                      <div className="grid grid-cols-[2rem_1fr_auto_auto_1.5rem] gap-4 items-center px-5 py-4">
                        <div className={cn("text-center font-mono font-bold text-sm shrink-0", rankColor)}>
                          {RankIcon ? <RankIcon className="w-4 h-4 mx-auto" /> : `${rank}`}
                        </div>
                        <div className="min-w-0 text-left">
                          <p className="font-semibold text-sm leading-tight truncate">{displayName(student)}</p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {displaySub(student) ?? `Active ${relativeTime(student.last_active)}`}
                          </p>
                        </div>
                        <div className="hidden md:flex items-center gap-1.5">
                          {Object.keys(TRACK_META).filter(t => trackTotals[t]).map((track) => {
                            const meta = TRACK_META[track]
                            const done = trackPassed[track] ?? 0
                            const total = trackTotals[track] ?? 0
                            if (!total) return null
                            return (
                              <div key={track} className={cn(
                                "px-2 py-0.5 rounded-md text-[10px] font-mono border transition-colors",
                                done === total
                                  ? `${meta.bgClass} ${meta.accentClass} border-current/30`
                                  : "bg-muted/30 text-muted-foreground border-border/50",
                              )}>
                                {done}/{total}
                              </div>
                            )
                          })}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono font-bold text-sm">
                            <span className="text-green-400">{student.passed}</span>
                            <span className="text-muted-foreground font-normal">/{totalLabs}</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{relativeTime(student.last_active)}</p>
                        </div>
                        <ChevronRight className={cn("w-4 h-4 transition-all", isSelected ? "rotate-90 text-primary" : "text-muted-foreground/40 group-hover:text-muted-foreground")} />
                      </div>
                      {pct > 0 && (
                        <div className="mx-5 mb-3 h-1 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full bg-primary/50 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* ── Lab Stats ── */}
            {tab === "cohort" && (
              <div className="space-y-2">
                {cohort.isLoading && <div className="text-center py-20 text-muted-foreground font-mono text-sm animate-pulse">Loading lab stats…</div>}
                {!cohort.isLoading && cohort.data?.length === 0 && (
                  <div className="text-center py-20 space-y-2">
                    <Target className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                    <p className="text-muted-foreground text-sm">No attempts recorded yet.</p>
                  </div>
                )}
                {cohort.data && cohort.data.length > 0 && (
                  <>
                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <span>Lab</span>
                      <span className="text-right w-20">Attempts</span>
                      <span className="text-right w-16">Passed</span>
                      <span className="text-right w-20">Pass rate</span>
                    </div>
                    {cohort.data?.map((row: CohortRow) => {
                      const meta = labMeta[row.lab_id]
                      const trackMeta = meta ? TRACK_META[meta.track] : null
                      const rate = row.attempted > 0 ? Math.round((row.passed / row.attempted) * 100) : 0
                      return (
                        <div key={row.lab_id} className="rounded-xl border border-border/50 bg-card/60 px-5 py-4">
                          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{meta?.title ?? row.lab_id}</p>
                              {trackMeta && (
                                <div className={cn("inline-flex items-center gap-1 mt-0.5 text-[10px] font-semibold", trackMeta.accentClass)}>
                                  <trackMeta.icon className="w-3 h-3" />{trackMeta.label}
                                </div>
                              )}
                            </div>
                            <span className="font-mono text-sm text-right w-20 text-muted-foreground">{row.attempted}</span>
                            <span className="font-mono text-sm text-right w-16 text-green-400">{row.passed}</span>
                            <div className="w-20 text-right space-y-1">
                              <span className={cn("font-mono text-sm font-bold", rate >= 80 ? "text-green-400" : rate >= 50 ? "text-amber-400" : "text-red-400")}>{rate}%</span>
                              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                                <div className={cn("h-full rounded-full", rate >= 80 ? "bg-green-400" : rate >= 50 ? "bg-amber-400" : "bg-red-400")} style={{ width: `${rate}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
            )}

            {/* ── Sessions ── */}
            {tab === "sessions" && (
              <div className="space-y-2">
                {sessions.isLoading && <div className="text-center py-20 text-muted-foreground font-mono text-sm animate-pulse">Loading sessions…</div>}
                {sessions.error && <div className="text-center py-20 text-red-400 font-mono text-sm">Failed to load sessions.</div>}
                {!sessions.isLoading && !sessions.error && sessions.data?.length === 0 && (
                  <div className="text-center py-20 space-y-2">
                    <Activity className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                    <p className="text-muted-foreground text-sm">No active sessions.</p>
                  </div>
                )}
                {sessions.data && sessions.data.length > 0 && (
                  <>
                    <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-5 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <span>Student</span><span>Lab</span><span className="w-20 text-center">Status</span><span className="w-16" />
                    </div>
                    {sessions.data.map((s: SessionRow) => {
                      const labTitle = labMeta[s.lab_id]?.title ?? s.lab_id
                      const trackMeta = labMeta[s.lab_id] ? TRACK_META[labMeta[s.lab_id].track] : null
                      const studentLabel = s.name ?? s.email?.split("@")[0] ?? `Guest ${s.student_id.slice(0, 8)}`
                      const isKilling = killSession.isPending && (killSession.variables as any)?.studentId === s.student_id && (killSession.variables as any)?.labId === s.lab_id
                      return (
                        <div key={`${s.student_id}:${s.lab_id}`} className="rounded-xl border border-border/50 bg-card/60 px-5 py-4 grid grid-cols-[1fr_1fr_auto_auto] gap-4 items-center">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{studentLabel}</p>
                            {s.email && s.name && <p className="text-[10px] text-muted-foreground truncate">{s.email}</p>}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm truncate">{labTitle}</p>
                            {trackMeta && (
                              <div className={cn("inline-flex items-center gap-1 mt-0.5 text-[10px] font-semibold", trackMeta.accentClass)}>
                                <trackMeta.icon className="w-3 h-3" />{trackMeta.label}
                              </div>
                            )}
                          </div>
                          <div className="w-20 flex justify-center">
                            <span className={cn("text-[10px] font-semibold px-2.5 py-1 rounded-full border",
                              s.status === "running"  ? "text-green-400 border-green-500/30 bg-green-500/10" :
                              s.status === "starting" ? "text-amber-400 border-amber-500/30 bg-amber-500/10" :
                                                        "text-red-400 border-red-500/30 bg-red-500/10",
                            )}>{s.status}</span>
                          </div>
                          <div className="w-16 flex justify-end">
                            <button
                              disabled={isKilling}
                              onClick={() => killSession.mutate({ studentId: s.student_id, labId: s.lab_id })}
                              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
                            >
                              {isKilling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
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

            {/* ── Password Resets ── */}
            {tab === "password-resets" && (
              <div className="space-y-2">
                {pwResets.isLoading && <div className="text-center py-20 text-muted-foreground font-mono text-sm animate-pulse">Loading requests…</div>}
                {pwResets.error && <div className="text-center py-20 text-red-400 font-mono text-sm">Failed to load password reset requests.</div>}
                {!pwResets.isLoading && !pwResets.error && pwResets.data?.length === 0 && (
                  <div className="text-center py-20 space-y-2">
                    <KeyRound className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                    <p className="text-muted-foreground text-sm">No password reset requests.</p>
                  </div>
                )}
                {pwResets.data && pwResets.data.length > 0 && (
                  <>
                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <span>Email</span><span className="w-24 text-center">Status</span><span className="w-20 text-center">Requested</span><span className="w-32" />
                    </div>
                    {pwResets.data.map((r: PasswordResetRequest) => {
                      const isApproving = approvePwReset.isPending && approvePwReset.variables === r.id
                      const isDismissing = dismissPwReset.isPending && dismissPwReset.variables === r.id
                      const tokenExpired = r.status === "approved" && !!r.expiresAt && new Date(r.expiresAt) < new Date()
                      return (
                        <div key={r.id} className="rounded-xl border border-border/50 bg-card/60 px-5 py-4 grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center">
                          <p className="text-sm font-medium truncate">{r.email}</p>
                          <div className="w-24 flex justify-center">
                            <span className={cn("text-[10px] font-semibold px-2.5 py-1 rounded-full border",
                              r.status === "pending"                   ? "text-amber-400 border-amber-500/30 bg-amber-500/10" :
                              r.status === "approved" && !tokenExpired ? "text-green-400 border-green-500/30 bg-green-500/10" :
                              r.status === "approved" && tokenExpired  ? "text-orange-400 border-orange-500/30 bg-orange-500/10" :
                                                                         "text-muted-foreground border-border bg-white/5",
                            )}>{tokenExpired ? "expired" : r.status}</span>
                          </div>
                          <span className="w-20 text-xs text-muted-foreground text-center font-mono">{relativeTime(r.requestedAt)}</span>
                          <div className="w-32 flex items-center gap-2 justify-end">
                            {(r.status === "pending" || tokenExpired) && (
                              <button
                                disabled={isApproving}
                                onClick={() => approvePwReset.mutate(r.id)}
                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-green-500/30 text-green-400 hover:bg-green-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
                              >
                                {isApproving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                {tokenExpired ? "Re-approve" : "Approve"}
                              </button>
                            )}
                            <button
                              disabled={isDismissing}
                              onClick={() => setConfirmDeleteReset(r)}
                              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              {isDismissing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
            )}

          </div>{/* end inner padding */}
        </div>{/* end scroll area */}

        {/* ── Student detail panel — inline sidebar ── */}
        {selectedStudent && (
          <div
            className="w-96 shrink-0 border-l border-border bg-[#0d0d0d] flex flex-col overflow-hidden"
            style={{ animation: "slideInPanel 0.18s ease-out" }}
          >
            <style>{`@keyframes slideInPanel{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>

            {/* Panel header */}
            <div className="shrink-0 px-5 pt-5 pb-4 border-b border-border/60">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-black text-primary text-sm">
                    {getInitial(selectedStudent)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm leading-tight truncate">{displayName(selectedStudent)}</p>
                    {displaySub(selectedStudent) && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{displaySub(selectedStudent)}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">Active {relativeTime(selectedStudent.last_active)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="shrink-0 w-7 h-7 rounded-lg hover:bg-white/5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Stats strip */}
            <div className="shrink-0 grid grid-cols-3 gap-px bg-border/60 border-b border-border/60">
              {[
                { label: "Passed",    value: `${selectedStudent.passed}`, sub: `of ${totalLabs}` },
                { label: "Pass Rate", value: `${sliderPassRate}%`,        sub: "of attempts"     },
                { label: "Avg Score", value: sliderPassedLabs.length > 0 ? `${sliderAvgScore}%` : "—", sub: "on passed labs" },
              ].map(({ label, value, sub }) => (
                <div key={label} className="bg-[#0d0d0d] px-3 py-3.5 text-center">
                  <p className="text-lg font-black font-mono text-foreground leading-none">{value}</p>
                  <p className="text-[9px] text-muted-foreground/50 mt-0.5 uppercase tracking-wider">{sub}</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide mt-1 font-semibold">{label}</p>
                </div>
              ))}
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">

              {/* Track progress */}
              <div className="px-5 pt-5 pb-5 border-b border-border/40">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 mb-4">Progress by Track</p>
                <div className="space-y-4">
                  {Object.entries(TRACK_META).map(([track, meta]) => {
                    const total = trackTotals[track] ?? 0
                    if (!total) return null
                    const passed = selectedStudent.labs.filter(l => l.status === "passed" && labMeta[l.labId]?.track === track).length
                    const inProgress = selectedStudent.labs.filter(l => l.status !== "passed" && labMeta[l.labId]?.track === track).length
                    const pct = Math.round((passed / total) * 100)
                    const Icon = meta.icon
                    return (
                      <div key={track}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <Icon className={cn("w-3.5 h-3.5", meta.accentClass)} />
                            <span className={cn("text-xs font-semibold", meta.accentClass)}>{meta.label}</span>
                            {passed === total && total > 0 && <CheckCircle2 className="w-3 h-3 text-green-400" />}
                          </div>
                          <div className="flex items-center gap-2">
                            {inProgress > 0 && <span className="text-[10px] text-muted-foreground">{inProgress} in progress</span>}
                            <span className="text-xs font-mono text-muted-foreground">
                              <span className={passed > 0 ? meta.accentClass : ""}>{passed}</span>/{total}
                            </span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: meta.accentHex }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Lab attempts */}
              <div className="px-5 pt-5 pb-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 mb-4">Lab Attempts</p>
                {selectedStudent.labs.length === 0 ? (
                  <div className="text-center py-6 space-y-2">
                    <Circle className="w-8 h-8 text-muted-foreground/20 mx-auto" />
                    <p className="text-xs text-muted-foreground">No lab attempts yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(TRACK_META).map(([track, meta]) => {
                      const trackLabs = selectedStudent.labs.filter(l => labMeta[l.labId]?.track === track)
                      if (!trackLabs.length) return null
                      const Icon = meta.icon
                      return (
                        <div key={track}>
                          <div className={cn("flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-2", meta.accentClass)}>
                            <Icon className="w-3 h-3" />{meta.label}
                          </div>
                          <div className="space-y-1.5 pl-1">
                            {trackLabs.map(l => (
                              <div key={l.labId} className="flex items-center gap-2.5">
                                {l.status === "passed"
                                  ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                                  : <Circle className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />}
                                <span className="flex-1 text-xs text-muted-foreground truncate">{labMeta[l.labId]?.title ?? l.labId}</span>
                                {l.status === "passed" && (
                                  <span className="shrink-0 text-[10px] font-mono font-bold text-green-400">{l.bestScore}%</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>{/* end scrollable body */}

            {/* Danger zone footer */}
            <div className="shrink-0 border-t border-border/60 px-5 py-4 bg-red-950/10">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-red-400/60 mb-3">Danger Zone</p>
              <div className="flex items-center gap-2">
                <button
                  disabled={resetProgress.isPending && resetProgress.variables === selectedStudent.id}
                  onClick={() => setConfirmReset(selectedStudent)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold"
                >
                  {resetProgress.isPending && resetProgress.variables === selectedStudent.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  Reset
                </button>
                <button
                  disabled={deleteAccount.isPending && deleteAccount.variables === selectedStudent.id}
                  onClick={() => { setConfirmDeleteAccount(selectedStudent); setDeleteAccountEmail("") }}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2.5 rounded-xl border border-red-800/50 text-red-500 hover:bg-red-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold"
                >
                  {deleteAccount.isPending && deleteAccount.variables === selectedStudent.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                  Delete
                </button>
              </div>
            </div>

          </div>
        )}{/* end student panel */}

      </div>{/* end split pane */}

      {/* ── Confirmation modals (always fixed/portal-like) ── */}

      {confirmDeleteAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                <UserX className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="font-bold text-base">Delete account permanently?</h2>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  This will permanently delete <span className="font-semibold text-foreground">{displayName(confirmDeleteAccount)}</span>'s
                  account along with all lab progress, sessions, and reset requests.{" "}
                  <span className="text-red-400 font-semibold">This cannot be undone.</span>
                </p>
              </div>
            </div>
            {confirmDeleteAccount.email && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">
                  Type <span className="font-mono font-semibold text-foreground">{confirmDeleteAccount.email}</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteAccountEmail}
                  onChange={(e) => setDeleteAccountEmail(e.target.value)}
                  placeholder={confirmDeleteAccount.email}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500/30"
                />
              </div>
            )}
            <div className="flex justify-end gap-2.5">
              <button onClick={() => { setConfirmDeleteAccount(null); setDeleteAccountEmail("") }} className="px-4 py-2.5 text-sm rounded-xl border border-border hover:bg-muted/50 transition-colors font-medium">Cancel</button>
              <button
                disabled={!!confirmDeleteAccount.email && deleteAccountEmail !== confirmDeleteAccount.email}
                onClick={() => { deleteAccount.mutate(confirmDeleteAccount.id); setConfirmDeleteAccount(null); setDeleteAccountEmail("") }}
                className="px-4 py-2.5 text-sm rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Delete account
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="font-bold text-base">Delete reset request?</h2>
                <p className="text-sm text-muted-foreground mt-1.5">
                  The password reset request for <span className="font-semibold text-foreground">{confirmDeleteReset.email}</span> will be permanently removed.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2.5">
              <button onClick={() => setConfirmDeleteReset(null)} className="px-4 py-2.5 text-sm rounded-xl border border-border hover:bg-muted/50 transition-colors font-medium">Cancel</button>
              <button onClick={() => { dismissPwReset.mutate(confirmDeleteReset.id); setConfirmDeleteReset(null) }} className="px-4 py-2.5 text-sm rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors">Delete request</button>
            </div>
          </div>
        </div>
      )}

      {confirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="font-bold text-base">Reset progress?</h2>
                <p className="text-sm text-muted-foreground mt-1.5">
                  All lab progress for <span className="font-semibold text-foreground">{displayName(confirmReset)}</span> will be permanently deleted. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2.5">
              <button onClick={() => setConfirmReset(null)} className="px-4 py-2.5 text-sm rounded-xl border border-border hover:bg-muted/50 transition-colors font-medium">Cancel</button>
              <button onClick={() => { resetProgress.mutate(confirmReset.id); setConfirmReset(null) }} className="px-4 py-2.5 text-sm rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors">Reset progress</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
