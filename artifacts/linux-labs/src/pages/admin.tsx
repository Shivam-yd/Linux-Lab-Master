import { useState, useMemo, useEffect } from "react"
import { Link } from "wouter"
import { useQuery } from "@tanstack/react-query"
import { useSession } from "@/lib/auth-client"
import { useListLabs } from "@workspace/api-client-react"
import {
  ArrowLeft, Users, BarChart3, ChevronRight,
  Trophy, Medal, Crown,
  CheckCircle2, Circle, ShieldAlert, Activity, XCircle, Loader2, RotateCcw,
  KeyRound, Trash2, UserX, X, TrendingUp, Zap, Target,
  Lock, Unlock, UserPlus, MailPlus, UserCheck, Search, ClipboardList,
} from "lucide-react"
import { AccountDropdown } from "@/components/account-dropdown"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { TRACK_META, DEFAULT_TRACK_META } from "@/lib/track-meta"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

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
  total_time_seconds: number
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

function fmtDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
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
  type Tab = "leaderboard" | "cohort" | "sessions" | "password-resets" | "registration"
  const TABS: Tab[] = ["leaderboard", "cohort", "sessions", "password-resets", "registration"]
  const hashTab = window.location.hash.replace("#", "") as Tab
  const [tab, setTab] = useState<Tab>(TABS.includes(hashTab) ? hashTab : "leaderboard")
  const setTabAndHash = (t: Tab) => { setTab(t); window.location.hash = t }
  // Sync tab when browser back/forward changes the hash
  useEffect(() => {
    const onPop = () => {
      const h = window.location.hash.replace("#", "") as Tab
      if (TABS.includes(h)) setTab(h)
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null)
  const [confirmReset, setConfirmReset] = useState<StudentRow | null>(null)
  const [confirmDeleteReset, setConfirmDeleteReset] = useState<PasswordResetRequest | null>(null)
  const [confirmApprovePwReset, setConfirmApprovePwReset] = useState<PasswordResetRequest | null>(null)
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState<StudentRow | null>(null)
  const [deleteAccountEmail, setDeleteAccountEmail] = useState("")
  const [newInviteEmail, setNewInviteEmail] = useState("")
  const [leaderboardSearch, setLeaderboardSearch] = useState("")
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

  type RegSettings = { id: number; mode: string }
  type RegInvite = { id: number; email: string; createdAt: string; usedAt: string | null }
  type RegRequest = { id: number; name: string; email: string; status: string; createdAt: string }

  const regSettings = useQuery<RegSettings>({
    queryKey: ["admin", "registration"],
    queryFn: () => fetchAdmin("/api/admin/registration"),
    retry: false,
    enabled: tab === "registration",
  })

  const regInvites = useQuery<RegInvite[]>({
    queryKey: ["admin", "registration", "invites"],
    queryFn: () => fetchAdmin("/api/admin/registration/invites"),
    retry: false,
    enabled: tab === "registration",
  })

  const regRequests = useQuery<RegRequest[]>({
    queryKey: ["admin", "registration", "requests"],
    queryFn: () => fetchAdmin("/api/admin/registration/requests"),
    retry: false,
    enabled: tab === "registration",
    refetchInterval: tab === "registration" ? 20_000 : false,
  })

  type AuditEvent = { event: string; email: string; name: string | null; at: string }
  const regAudit = useQuery<AuditEvent[]>({
    queryKey: ["admin", "registration", "audit"],
    queryFn: () => fetchAdmin("/api/admin/registration/audit"),
    retry: false,
    enabled: tab === "registration",
  })

  const setRegMode = useMutation({
    mutationFn: async (mode: string) => {
      const res = await fetch("/api/admin/registration", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      })
      if (!res.ok) throw new Error("Failed to update mode")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "registration"] }),
  })

  const addInvite = useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch("/api/admin/registration/invites", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error("Failed to add invite")
    },
    onSuccess: () => {
      setNewInviteEmail("")
      queryClient.invalidateQueries({ queryKey: ["admin", "registration", "invites"] })
    },
  })

  const removeInvite = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/registration/invites/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to remove invite")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "registration", "invites"] }),
  })

  const approveRequest = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/registration/requests/${id}/approve`, { method: "POST" })
      if (!res.ok) throw new Error("Failed to approve request")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "registration", "requests"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "registration", "invites"] })
    },
  })

  const denyRequest = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/registration/requests/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to deny request")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "registration", "requests"] }),
  })

  const approvePwReset = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/password-reset-requests/${id}/approve`, { method: "POST" })
      if (!res.ok) throw new Error("Failed to approve request")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "password-resets"] }),
    onError: (err: Error) => toast({ title: "Failed to approve reset", description: err.message, variant: "destructive" }),
  })

  const dismissPwReset = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/password-reset-requests/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to dismiss request")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "password-resets"] }),
    onError: (err: Error) => toast({ title: "Failed to dismiss reset", description: err.message, variant: "destructive" }),
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
      setSelectedStudent(null)
      queryClient.invalidateQueries({ queryKey: ["admin", "leaderboard"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "sessions"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "cohort"] })
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
    onSuccess: () => {
      setSelectedStudent(null)
      queryClient.invalidateQueries({ queryKey: ["admin", "leaderboard"] })
    },
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
      <header className="shrink-0 border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <div className="px-6 h-14 flex items-center justify-between">
          {/* Back link */}
          <Link
            href={`${basePath}/dashboard`}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Dashboard
          </Link>

          {/* Brand + badge */}
          <div className="flex items-center gap-3">
            <img src={`${basePath}/logo.svg`} className="w-7 h-7 rounded-lg" alt="DevLabMaster" />
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight">DevLabMaster</span>
              <span className="hidden sm:block w-px h-3.5 bg-border/60" />
              <span className="hidden sm:block text-xs text-muted-foreground font-medium">Instructor Panel</span>
            </div>
            <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded border border-primary/30 text-primary bg-primary/8">
              Admin
            </span>
          </div>

          <AccountDropdown />
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
              { id: "registration",    label: "Registration",   icon: Lock      },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTabAndHash(id)}
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
              <div className="space-y-3">
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
                {students.length > 0 && (() => {
                  const q = leaderboardSearch.trim().toLowerCase()
                  const filtered = q
                    ? students.filter(s =>
                        (s.name ?? "").toLowerCase().includes(q) ||
                        (s.email ?? "").toLowerCase().includes(q)
                      )
                    : students
                  return (
                    <>
                      {/* Search bar */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                        <input
                          type="text"
                          placeholder="Search by name or email…"
                          value={leaderboardSearch}
                          onChange={e => setLeaderboardSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 bg-card border border-border/60 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/40"
                        />
                        {leaderboardSearch && (
                          <button
                            onClick={() => setLeaderboardSearch("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Column headers */}
                      <div className="grid grid-cols-[2rem_1fr_auto_auto_1.5rem] gap-4 px-5 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        <span>#</span><span>Student</span>
                        <span className="hidden md:block">Track Progress</span>
                        <span className="text-right">Labs</span><span />
                      </div>

                      {filtered.length === 0 && (
                        <div className="text-center py-10 text-muted-foreground text-sm">
                          No students match "{leaderboardSearch}".
                        </div>
                      )}

                      {filtered.map((student) => {
                        const rank = students.indexOf(student) + 1
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
                    </>
                  )
                })()}
              </div>
            )}

            {/* ── Lab Stats ── */}
            {tab === "cohort" && (
              <div className="space-y-8">
                {cohort.isLoading && (
                  <div className="text-center py-20 text-muted-foreground text-sm animate-pulse">Loading lab stats…</div>
                )}
                {!cohort.isLoading && cohort.data?.length === 0 && (
                  <div className="text-center py-20 space-y-2">
                    <Target className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                    <p className="text-muted-foreground text-sm">No attempts recorded yet.</p>
                  </div>
                )}
                {cohort.data && cohort.data.length > 0 && (() => {
                  // Group rows by track
                  const byTrack: Record<string, CohortRow[]> = {}
                  for (const row of cohort.data as CohortRow[]) {
                    const track = labMeta[row.lab_id]?.track ?? "unknown"
                    ;(byTrack[track] ??= []).push(row)
                  }
                  return Object.entries(byTrack).map(([track, rows]) => {
                    const tm = TRACK_META[track] ?? DEFAULT_TRACK_META
                    const trackAttempts = rows.reduce((a, r) => a + r.attempted, 0)
                    const trackPassed   = rows.reduce((a, r) => a + r.passed,   0)
                    const avgRate = trackAttempts > 0 ? Math.round((trackPassed / trackAttempts) * 100) : 0
                    const avgColor = avgRate >= 80 ? "text-green-400" : avgRate >= 50 ? "text-amber-400" : "text-red-400"
                    return (
                      <div key={track}>
                        {/* Track header */}
                        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-border/40">
                          <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", tm.bgClass)}>
                            <tm.icon className={cn("w-3.5 h-3.5", tm.accentClass)} />
                          </div>
                          <p className={cn("text-sm font-bold", tm.accentClass)}>{tm.label}</p>
                          <p className="text-xs text-muted-foreground">{rows.length} lab{rows.length !== 1 ? "s" : ""}</p>
                          <div className="flex-1" />
                          <span className={cn("text-sm font-bold font-mono", avgColor)}>{avgRate}%</span>
                          <span className="text-xs text-muted-foreground">avg pass rate</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">{trackAttempts} attempts</span>
                        </div>

                        {/* Column headers */}
                        <div className="grid grid-cols-[1fr_56px_56px_200px] gap-x-4 px-3 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          <span>Lab</span>
                          <span className="text-right">Attempts</span>
                          <span className="text-right">Passed</span>
                          <span className="text-right">Pass rate</span>
                        </div>

                        {/* Lab rows */}
                        <div>
                          {rows.map(row => {
                            const rate = row.attempted > 0 ? Math.round((row.passed / row.attempted) * 100) : 0
                            const barColor  = rate >= 80 ? "bg-green-400"   : rate >= 50 ? "bg-amber-400"   : "bg-red-400"
                            const textColor = rate >= 80 ? "text-green-400" : rate >= 50 ? "text-amber-400" : "text-red-400"
                            return (
                              <div
                                key={row.lab_id}
                                className="grid grid-cols-[1fr_56px_56px_200px] gap-x-4 items-center px-3 py-2.5 rounded-lg hover:bg-muted/20 transition-colors"
                              >
                                <p className="text-sm truncate text-foreground/90">
                                  {labMeta[row.lab_id]?.title ?? row.lab_id}
                                </p>
                                <span className="text-sm font-mono text-right text-muted-foreground">{row.attempted}</span>
                                <span className="text-sm font-mono text-right text-foreground">{row.passed}</span>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                    <div
                                      className={cn("h-full rounded-full", barColor)}
                                      style={{ width: `${rate}%` }}
                                    />
                                  </div>
                                  <span className={cn("text-xs font-bold font-mono w-8 text-right shrink-0", textColor)}>
                                    {rate}%
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                })()}
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
                                onClick={() => setConfirmApprovePwReset(r)}
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

            {/* ── Registration ── */}
            {tab === "registration" && (
              <div className="space-y-6 max-w-4xl">

                {/* ── Mode selector ── */}
                <div>
                  <div className="mb-3">
                    <p className="text-sm font-semibold">Registration mode</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Controls how new accounts can be created</p>
                  </div>
                  {regSettings.isLoading
                    ? <div className="grid grid-cols-3 gap-3">{[0,1,2].map(i => <div key={i} className="h-24 rounded-xl bg-muted/20 animate-pulse" />)}</div>
                    : (
                      <div className="grid grid-cols-3 gap-3">
                        {([
                          {
                            value: "open",
                            icon: Unlock,
                            label: "Open",
                            desc: "Anyone can create an account",
                            active: "border-green-500/50 bg-green-500/8 text-green-400",
                            icon_active: "text-green-400",
                          },
                          {
                            value: "invite_only",
                            icon: Lock,
                            label: "Invite only",
                            desc: "Only pre-approved emails can register",
                            active: "border-amber-500/50 bg-amber-500/8 text-amber-300",
                            icon_active: "text-amber-400",
                          },
                          {
                            value: "invite_or_request",
                            icon: UserPlus,
                            label: "Invite + requests",
                            desc: "Students can request access for review",
                            active: "border-violet-500/50 bg-violet-500/8 text-violet-300",
                            icon_active: "text-violet-400",
                          },
                        ] as const).map(({ value, icon: Icon, label, desc, active, icon_active }) => {
                          const isActive = regSettings.data?.mode === value
                          return (
                            <button
                              key={value}
                              onClick={() => { if (!isActive) setRegMode.mutate(value) }}
                              disabled={isActive || setRegMode.isPending}
                              className={cn(
                                "flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-all duration-150 disabled:opacity-60",
                                isActive
                                  ? active
                                  : "border-border/40 bg-card/40 hover:bg-card/80 hover:border-border text-muted-foreground",
                              )}
                            >
                              <Icon className={cn("w-4 h-4", isActive ? icon_active : "text-muted-foreground/60")} />
                              <div>
                                <p className={cn("text-xs font-semibold", isActive ? "" : "text-foreground/70")}>{label}</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{desc}</p>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )
                  }
                </div>

                {/* ── Approved emails + Account requests side by side ── */}
                <div className="grid grid-cols-2 gap-0 items-start divide-x divide-border/50 border-t border-border/50 pt-6">

                {/* ── Approved emails (invites) ── */}
                <div className="space-y-3 pr-6">
                  <div className="flex items-center gap-2">
                    <MailPlus className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-semibold">Approved emails</p>
                    {!regInvites.isLoading && (regInvites.data?.length ?? 0) > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted/40 border border-border/50 text-muted-foreground font-medium">
                        {regInvites.data!.length}
                      </span>
                    )}
                  </div>

                  <form
                    onSubmit={e => { e.preventDefault(); if (newInviteEmail) addInvite.mutate(newInviteEmail) }}
                    className="flex gap-2"
                  >
                    <input
                      type="email"
                      placeholder="student@example.com"
                      value={newInviteEmail}
                      onChange={e => setNewInviteEmail(e.target.value)}
                      className="flex-1 bg-background/60 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
                    />
                    <button
                      type="submit"
                      disabled={addInvite.isPending || !newInviteEmail}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {addInvite.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MailPlus className="w-3.5 h-3.5" />}
                      Add
                    </button>
                  </form>

                  {regInvites.isLoading && (
                    <p className="text-sm text-muted-foreground animate-pulse py-4">Loading…</p>
                  )}
                  {!regInvites.isLoading && regInvites.data?.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4">No approved emails yet — add one above.</p>
                  )}
                  {regInvites.data && regInvites.data.length > 0 && (
                    <div className="space-y-1">
                      {regInvites.data.map((inv: { id: number; email: string; usedAt: string | null }) => (
                        <div key={inv.id} className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg group hover:bg-muted/20 transition-colors",
                          inv.usedAt && "opacity-50"
                        )}>
                          <div className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0",
                            inv.usedAt ? "bg-muted/30 text-muted-foreground" : "bg-primary/15 text-primary"
                          )}>
                            {inv.email.charAt(0).toUpperCase()}
                          </div>
                          <span className="flex-1 text-sm truncate">{inv.email}</span>
                          {inv.usedAt
                            ? <span className="text-[10px] px-2 py-0.5 rounded-full border border-green-500/20 text-green-400 bg-green-500/8 font-medium shrink-0">registered</span>
                            : <span className="text-[10px] px-2 py-0.5 rounded-full border border-border/40 text-muted-foreground bg-muted/10 font-medium shrink-0">pending</span>
                          }
                          <button
                            onClick={() => removeInvite.mutate(inv.id)}
                            disabled={removeInvite.isPending && removeInvite.variables === inv.id}
                            className="shrink-0 p-1 rounded text-muted-foreground/30 hover:text-red-400 hover:bg-red-500/8 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-40"
                            title="Remove"
                          >
                            {removeInvite.isPending && removeInvite.variables === inv.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Account requests ── */}
                <div className="space-y-3 pl-6">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-semibold">Account requests</p>
                    {!regRequests.isLoading && (regRequests.data?.length ?? 0) > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted/40 border border-border/50 text-muted-foreground font-medium">
                        {regRequests.data!.length}
                      </span>
                    )}
                    {(regRequests.data?.filter((r: { status: string }) => r.status === "pending").length ?? 0) > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-semibold">
                        {regRequests.data!.filter((r: { status: string }) => r.status === "pending").length} pending
                      </span>
                    )}
                  </div>

                  {regRequests.isLoading && (
                    <p className="text-sm text-muted-foreground animate-pulse py-4">Loading…</p>
                  )}
                  {!regRequests.isLoading && regRequests.data?.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-8">
                      <UserPlus className="w-7 h-7 text-muted-foreground/25" />
                      <p className="text-sm text-muted-foreground">No account requests yet.</p>
                    </div>
                  )}
                  {regRequests.data && regRequests.data.length > 0 && (
                    <div className="space-y-1">
                      {regRequests.data.map((r: { id: number; name: string; email: string; status: string; createdAt: string }) => (
                        <div key={r.id} className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/20 transition-colors",
                          r.status !== "pending" && "opacity-50"
                        )}>
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                            r.status === "pending"  ? "bg-amber-500/15 text-amber-400" :
                            r.status === "approved" ? "bg-green-500/15 text-green-400" :
                                                      "bg-muted/20 text-muted-foreground",
                          )}>
                            {r.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{r.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                          </div>
                          <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full border font-semibold shrink-0",
                            r.status === "pending"  ? "text-amber-400 border-amber-500/30 bg-amber-500/10" :
                            r.status === "approved" ? "text-green-400 border-green-500/30 bg-green-500/10" :
                                                      "text-muted-foreground border-border bg-white/5",
                          )}>{r.status}</span>
                          <span className="text-xs text-muted-foreground font-mono w-14 text-right shrink-0">{relativeTime(r.createdAt)}</span>
                          {r.status === "pending" && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => approveRequest.mutate(r.id)}
                                disabled={approveRequest.isPending && approveRequest.variables === r.id}
                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 disabled:opacity-40 transition-colors font-semibold"
                              >
                                {approveRequest.isPending && approveRequest.variables === r.id
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <UserCheck className="w-3 h-3" />}
                                Approve
                              </button>
                              <button
                                onClick={() => denyRequest.mutate(r.id)}
                                disabled={denyRequest.isPending && denyRequest.variables === r.id}
                                title="Dismiss"
                                className="p-1.5 rounded-lg border border-border/40 text-muted-foreground hover:border-red-500/30 hover:text-red-400 hover:bg-red-500/8 disabled:opacity-40 transition-colors"
                              >
                                {denyRequest.isPending && denyRequest.variables === r.id
                                  ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                </div>{/* end side-by-side grid */}

                {/* ── Audit log ── */}
                <div className="border-t border-border/50 pt-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-semibold">Activity log</p>
                    {!regAudit.isLoading && (regAudit.data?.length ?? 0) > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted/40 border border-border/50 text-muted-foreground font-medium">
                        {regAudit.data!.length}
                      </span>
                    )}
                  </div>
                  {regAudit.isLoading && <p className="text-sm text-muted-foreground animate-pulse py-4">Loading…</p>}
                  {!regAudit.isLoading && !regAudit.data?.length && (
                    <p className="text-sm text-muted-foreground py-4">No registration activity yet.</p>
                  )}
                  {regAudit.data && regAudit.data.length > 0 && (
                    <div className="space-y-px">
                      {regAudit.data.map((ev, i) => {
                        const cfg =
                          ev.event === "invited"    ? { label: "Invited",    dot: "bg-primary/60"    } :
                          ev.event === "registered" ? { label: "Registered", dot: "bg-green-400"     } :
                          ev.event === "approved"   ? { label: "Approved",   dot: "bg-green-600"     } :
                          ev.event === "denied"     ? { label: "Denied",     dot: "bg-red-500"       } :
                                                      { label: "Requested",  dot: "bg-amber-400"     }
                        return (
                          <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/20 transition-colors">
                            <span className={cn("w-2 h-2 rounded-full shrink-0", cfg.dot)} />
                            <span className="text-[11px] font-semibold text-muted-foreground w-20 shrink-0">{cfg.label}</span>
                            <span className="flex-1 text-sm truncate">
                              {ev.name ? <><span className="font-medium">{ev.name}</span> <span className="text-muted-foreground">({ev.email})</span></> : ev.email}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono shrink-0">{relativeTime(ev.at)}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

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
            <div className="shrink-0 grid grid-cols-4 gap-px bg-border/60 border-b border-border/60">
              {[
                { label: "Passed",    value: `${selectedStudent.passed}`, sub: `of ${totalLabs}` },
                { label: "Pass Rate", value: `${sliderPassRate}%`,        sub: "of attempts"     },
                { label: "Avg Score", value: sliderPassedLabs.length > 0 ? `${sliderAvgScore}%` : "—", sub: "on passed labs" },
                { label: "Time",      value: fmtDuration(selectedStudent.total_time_seconds ?? 0), sub: "platform total" },
              ].map(({ label, value, sub }) => (
                <div key={label} className="bg-[#0d0d0d] px-2 py-3.5 text-center">
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

      {confirmApprovePwReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-green-500/15 border border-green-500/20 flex items-center justify-center">
                <KeyRound className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h2 className="font-bold text-base">Approve password reset?</h2>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  A reset token will be generated for <span className="font-semibold text-foreground">{confirmApprovePwReset.email}</span> immediately.
                  {confirmApprovePwReset.status === "approved" && " The previous token will be invalidated."}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2.5">
              <button onClick={() => setConfirmApprovePwReset(null)} className="px-4 py-2.5 text-sm rounded-xl border border-border hover:bg-muted/50 transition-colors font-medium">Cancel</button>
              <button
                onClick={() => { approvePwReset.mutate(confirmApprovePwReset.id); setConfirmApprovePwReset(null) }}
                className="px-4 py-2.5 text-sm rounded-xl bg-green-700 hover:bg-green-800 text-white font-semibold transition-colors"
              >
                {confirmApprovePwReset.status === "approved" ? "Re-approve" : "Approve"}
              </button>
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
