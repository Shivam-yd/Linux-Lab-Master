import { useState, useMemo } from "react"
import { Link } from "wouter"
import { useQuery } from "@tanstack/react-query"
import { useSession } from "@/lib/auth-client"
import { useListLabs } from "@workspace/api-client-react"
import {
  ArrowLeft, Users, BarChart3, ChevronDown, ChevronRight,
  Trophy, Medal, Crown, Terminal, Layers, Server, Container, GitBranch,
  Clock, CheckCircle2, Circle, ShieldAlert, Activity, XCircle, Loader2, RotateCcw,
  KeyRound, Trash2, UserX, X, ChevronLast,
} from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

const TRACK_META: Record<string, { label: string; accentClass: string; bgClass: string }> = {
  linux:     { label: "Linux",     accentClass: "text-cyan-400",   bgClass: "bg-cyan-400/10"   },
  terraform: { label: "Terraform", accentClass: "text-purple-400", bgClass: "bg-purple-400/10" },
  jenkins:   { label: "Jenkins",   accentClass: "text-orange-400", bgClass: "bg-orange-400/10" },
  docker:    { label: "Docker",    accentClass: "text-sky-400",    bgClass: "bg-sky-400/10"    },
  git:       { label: "Git",       accentClass: "text-red-400",    bgClass: "bg-red-400/10"    },
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "leaderboard"] }),
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

  // Slide-over derived values (safe to compute even when null — guarded in JSX)
  const sliderPassRate = selectedStudent && selectedStudent.attempted > 0
    ? Math.round((selectedStudent.passed / selectedStudent.attempted) * 100) : 0
  const sliderPassedLabs = selectedStudent?.labs.filter(l => l.status === "passed") ?? []
  const sliderAvgScore = sliderPassedLabs.length > 0
    ? Math.round(sliderPassedLabs.reduce((a, l) => a + l.bestScore, 0) / sliderPassedLabs.length) : 0

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
            { id: "leaderboard",    label: "Leaderboard",    icon: Trophy },
            { id: "cohort",         label: "Lab Stats",      icon: BarChart3 },
            { id: "sessions",       label: "Sessions",       icon: Activity },
            { id: "password-resets", label: "Password Resets", icon: KeyRound },
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

              // Per-track passed counts (for row badges)
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
                <button
                  key={student.id}
                  onClick={() => setSelectedStudent(student)}
                  className="w-full rounded-xl border border-border/50 bg-card/50 flex items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.03] transition-colors"
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

                  <ChevronLast className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
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

        {/* ── Password Resets tab ───────────────────────────────────────────── */}
        {tab === "password-resets" && (
          <div className="space-y-2">
            {pwResets.isLoading && (
              <div className="text-center py-16 text-muted-foreground font-mono text-sm animate-pulse">
                Loading requests…
              </div>
            )}
            {pwResets.error && (
              <div className="text-center py-16 text-red-400 font-mono text-sm">
                Failed to load password reset requests.
              </div>
            )}
            {!pwResets.isLoading && pwResets.data?.length === 0 && (
              <div className="text-center py-16 text-muted-foreground font-mono text-sm">
                No password reset requests.
              </div>
            )}
            {pwResets.data && pwResets.data.length > 0 && (
              <>
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-2 text-xs font-mono text-muted-foreground uppercase tracking-wide">
                  <span>Email</span>
                  <span className="w-24 text-center">Status</span>
                  <span className="w-20 text-center">Requested</span>
                  <span className="w-28" />
                </div>
                {pwResets.data.map((r) => {
                  const isApproving = approvePwReset.isPending && approvePwReset.variables === r.id
                  const isDismissing = dismissPwReset.isPending && dismissPwReset.variables === r.id
                  const tokenExpired = r.status === "approved" && !!r.expiresAt && new Date(r.expiresAt) < new Date()
                  return (
                    <div
                      key={r.id}
                      className="rounded-xl border border-border/50 bg-card/50 px-5 py-4 grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center"
                    >
                      <p className="text-sm font-medium truncate">{r.email}</p>

                      <div className="w-24 flex justify-center">
                        <span className={cn(
                          "text-[10px] font-mono px-2 py-0.5 rounded-full border",
                          r.status === "pending"               ? "text-amber-400 border-amber-500/30 bg-amber-500/10" :
                          r.status === "approved" && !tokenExpired ? "text-green-400 border-green-500/30 bg-green-500/10" :
                          r.status === "approved" && tokenExpired  ? "text-orange-400 border-orange-500/30 bg-orange-500/10" :
                                                                     "text-muted-foreground border-border bg-white/5",
                        )}>
                          {tokenExpired ? "expired" : r.status}
                        </span>
                      </div>

                      <span className="w-20 text-xs text-muted-foreground text-center font-mono">
                        {relativeTime(r.requestedAt)}
                      </span>

                      <div className="w-28 flex items-center gap-2 justify-end">
                        {(r.status === "pending" || tokenExpired) && (
                          <button
                            disabled={isApproving}
                            onClick={() => approvePwReset.mutate(r.id)}
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-green-500/30 text-green-400 hover:bg-green-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            {isApproving
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <CheckCircle2 className="w-3.5 h-3.5" />}
                            {tokenExpired ? "Re-approve" : "Approve"}
                          </button>
                        )}
                        <button
                          disabled={isDismissing}
                          onClick={() => setConfirmDeleteReset(r)}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          title="Delete request"
                        >
                          {isDismissing
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
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

      {/* ── Delete account confirmation modal ────────────────────────────── */}
      {confirmDeleteAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-full bg-red-500/15 p-2">
                <UserX className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="font-semibold text-base">Delete account permanently?</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  This will permanently delete{" "}
                  <span className="font-medium text-foreground">{displayName(confirmDeleteAccount)}</span>'s
                  account along with all lab progress, sessions, and password reset requests.{" "}
                  <span className="text-red-400 font-medium">This cannot be undone.</span>
                </p>
              </div>
            </div>
            {confirmDeleteAccount.email && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-mono">
                  Type <span className="text-foreground font-medium">{confirmDeleteAccount.email}</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteAccountEmail}
                  onChange={(e) => setDeleteAccountEmail(e.target.value)}
                  placeholder={confirmDeleteAccount.email}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-red-500/50"
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => { setConfirmDeleteAccount(null); setDeleteAccountEmail("") }}
                className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={
                  !!confirmDeleteAccount.email && deleteAccountEmail !== confirmDeleteAccount.email
                }
                onClick={() => {
                  deleteAccount.mutate(confirmDeleteAccount.id)
                  setConfirmDeleteAccount(null)
                  setDeleteAccountEmail("")
                }}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Delete account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete password reset request confirmation modal ──────────────── */}
      {confirmDeleteReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-full bg-red-500/15 p-2">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="font-semibold text-base">Delete reset request?</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  The password reset request for{" "}
                  <span className="font-medium text-foreground">{confirmDeleteReset.email}</span>{" "}
                  will be permanently removed.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setConfirmDeleteReset(null)}
                className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  dismissPwReset.mutate(confirmDeleteReset.id)
                  setConfirmDeleteReset(null)
                }}
                className="px-4 py-2 text-sm rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
              >
                Delete request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Student profile slide-over ───────────────────────────────────── */}
      {selectedStudent && (
        <div className="fixed inset-0 z-40 flex justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedStudent(null)} />

          {/* Panel */}
          <div className="relative w-full max-w-md bg-card border-l border-border h-full flex flex-col overflow-hidden">

            {/* Header */}
            <div className="shrink-0 border-b border-border px-6 py-5 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-sm uppercase">
                  {displayName(selectedStudent).charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{displayName(selectedStudent)}</p>
                  {displaySub(selectedStudent) && <p className="text-xs text-muted-foreground truncate">{displaySub(selectedStudent)}</p>}
                  <p className="text-[10px] text-muted-foreground mt-0.5">Last active {relativeTime(selectedStudent.last_active)}</p>
                </div>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stats strip */}
            <div className="shrink-0 grid grid-cols-3 divide-x divide-border border-b border-border">
              {[
                { label: "Passed", value: `${selectedStudent.passed}/${totalLabs}` },
                { label: "Pass rate", value: `${sliderPassRate}%` },
                { label: "Avg score", value: sliderPassedLabs.length > 0 ? `${sliderAvgScore}%` : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="px-4 py-3 text-center">
                  <p className="text-lg font-bold font-mono text-foreground">{value}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">

              {/* Track breakdown */}
              <div className="px-6 pt-5 pb-4 border-b border-border space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Progress by track</p>
                {Object.entries(TRACK_META).map(([track, meta]) => {
                  const total = trackTotals[track] ?? 0
                  if (!total) return null
                  const passed = selectedStudent.labs.filter(l => l.status === "passed" && labMeta[l.labId]?.track === track).length
                  const inProgress = selectedStudent.labs.filter(l => l.status !== "passed" && labMeta[l.labId]?.track === track).length
                  const pct = Math.round((passed / total) * 100)
                  const barColor = meta.accentClass.replace("text-", "bg-")
                  return (
                    <div key={track}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn("text-xs font-medium", meta.accentClass)}>{meta.label}</span>
                        <span className="text-xs text-muted-foreground font-mono">{passed}/{total}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${pct}%` }} />
                      </div>
                      {inProgress > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{inProgress} in progress</p>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Lab list grouped by track */}
              <div className="px-6 pt-5 pb-6 space-y-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Lab attempts</p>
                {selectedStudent.labs.length === 0 ? (
                  <p className="text-xs text-muted-foreground font-mono">No lab attempts yet.</p>
                ) : Object.entries(TRACK_META).map(([track, meta]) => {
                  const trackLabs = selectedStudent.labs.filter(l => labMeta[l.labId]?.track === track)
                  if (!trackLabs.length) return null
                  return (
                    <div key={track} className="space-y-1.5">
                      <p className={cn("text-[10px] font-bold uppercase tracking-wider", meta.accentClass)}>{meta.label}</p>
                      {trackLabs.map(l => (
                        <div key={l.labId} className="flex items-center gap-2.5">
                          {l.status === "passed"
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                            : <Circle className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />}
                          <span className="flex-1 text-xs text-muted-foreground truncate" title={labMeta[l.labId]?.title ?? l.labId}>
                            {labMeta[l.labId]?.title ?? l.labId}
                          </span>
                          {l.status === "passed" && (
                            <span className="shrink-0 text-[10px] font-mono text-green-400">{l.bestScore}%</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Actions footer */}
            <div className="shrink-0 border-t border-border px-6 py-4 flex items-center gap-2">
              <button
                disabled={resetProgress.isPending && resetProgress.variables === selectedStudent.id}
                onClick={() => setConfirmReset(selectedStudent)}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {resetProgress.isPending && resetProgress.variables === selectedStudent.id
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <RotateCcw className="w-3.5 h-3.5" />}
                Reset progress
              </button>
              <button
                disabled={deleteAccount.isPending && deleteAccount.variables === selectedStudent.id}
                onClick={() => { setConfirmDeleteAccount(selectedStudent); setDeleteAccountEmail("") }}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-red-800/50 text-red-500 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {deleteAccount.isPending && deleteAccount.variables === selectedStudent.id
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <UserX className="w-3.5 h-3.5" />}
                Delete account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset progress confirmation modal ─────────────────────────────── */}
      {confirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-full bg-red-500/15 p-2">
                <RotateCcw className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="font-semibold text-base">Reset progress?</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  All lab progress for{" "}
                  <span className="font-medium text-foreground">{displayName(confirmReset)}</span>{" "}
                  will be permanently deleted. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setConfirmReset(null)}
                className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  resetProgress.mutate(confirmReset.id)
                  setConfirmReset(null)
                }}
                className="px-4 py-2 text-sm rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
              >
                Reset progress
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
