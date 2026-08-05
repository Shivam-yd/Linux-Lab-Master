import { useState, useMemo, useEffect, useRef } from "react"
import { useMeta } from "@/hooks/use-meta"
import { Link } from "wouter"
import { useQuery } from "@tanstack/react-query"
import { useSession } from "@/lib/auth-client"
import { useListLabs } from "@workspace/api-client-react"
import {
  ArrowLeft, Users, BarChart3, ChevronRight,
  Trophy, Medal, Crown, Award,
  CheckCircle2, Circle, ShieldAlert, Activity, XCircle, Loader2, RotateCcw,
  KeyRound, Trash2, UserX, X, TrendingUp, Target,
  Lock, Unlock, UserPlus, MailPlus, UserCheck, Search, ClipboardList, Star,
  Eye, EyeOff, Beaker, CreditCard, ExternalLink, ShieldCheck, Server, Database, Bug, History,
} from "lucide-react"
import { AccountDropdown } from "@/components/account-dropdown"
import { ThemeToggle } from "@/components/theme-toggle"
import { NotificationBell } from "@/components/notification-bell"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { TRACK_META, DEFAULT_TRACK_META } from "@/lib/track-meta"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

type Tab = "leaderboard" | "cohort" | "sessions" | "password-resets" | "registration" | "certificates" | "labs" | "operations"

const ADMIN_NAV: { id: Tab; label: string; icon: typeof Trophy }[] = [
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
  { id: "cohort", label: "Lab Insights", icon: BarChart3 },
  { id: "sessions", label: "Sessions", icon: Activity },
  { id: "password-resets", label: "Password Resets", icon: KeyRound },
  { id: "registration", label: "Registration", icon: Lock },
  { id: "certificates", label: "Certificates", icon: Award },
  { id: "labs", label: "Labs", icon: Beaker },
  { id: "operations", label: "Operations", icon: ShieldCheck },
]

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
  banned: boolean
  passed: number
  attempted: number
  last_active: string | null
  total_time_seconds: number
  labs: { labId: string; status: string; bestScore: number }[]
}

type LabInsightRow = {
  lab_id: string
  attempted: number
  passed: number
  easy: number
  ok: number
  hard: number
  ratings: number
}

function displayName(s: StudentRow) {
  if (s.name) return s.name
  if (s.email) return s.email.split("@")[0]
  return s.id.slice(0, 8)
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
  const adminAccess = useQuery<{ isAdmin: boolean }>({
    queryKey: ["admin", "access"],
    queryFn: async () => {
      const res = await fetch("/api/admin/check", { credentials: "include" })
      if (!res.ok) throw new Error("Unable to check admin access")
      return res.json()
    },
    enabled: !isPending,
    retry: false,
  })
  const canLoadAdminData = !isPending && !adminAccess.isLoading && adminAccess.data?.isAdmin === true
  const { data: labs } = useListLabs({
    query: { queryKey: ["/api/labs"], enabled: canLoadAdminData },
  })
  const TABS: Tab[] = ADMIN_NAV.map(({ id }) => id)
  const hashTab = window.location.hash.replace("#", "") as Tab
  const [tab, setTab] = useState<Tab>(TABS.includes(hashTab) ? hashTab : "leaderboard")
  const setTabAndHash = (t: Tab) => { setTab(t); window.location.hash = t }
  // Sync tab when browser back/forward changes the hash
  useMeta("Admin — DevLabMaster")
  useEffect(() => {
    const onPop = () => {
      const h = window.location.hash.replace("#", "") as Tab
      if (TABS.includes(h)) setTab(h)
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => setScrolled(el.scrollTop > 0)
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [])

  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null)
  const [confirmReset, setConfirmReset] = useState<StudentRow | null>(null)
  const [confirmDeleteReset, setConfirmDeleteReset] = useState<PasswordResetRequest | null>(null)
  const [confirmApprovePwReset, setConfirmApprovePwReset] = useState<PasswordResetRequest | null>(null)
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState<StudentRow | null>(null)
  const [confirmDenyRequest, setConfirmDenyRequest] = useState<{ id: number; name: string; email: string } | null>(null)
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<number>>(new Set())
  const [deleteAccountEmail, setDeleteAccountEmail] = useState("")
  const [newInviteEmail, setNewInviteEmail] = useState("")
  const [openLevels, setOpenLevels] = useState<Set<string>>(new Set())
  const [leaderboardSearch, setLeaderboardSearch] = useState("")
  const [labSearch, setLabSearch] = useState("")
  const [certificateSearch, setCertificateSearch] = useState("")
  const [certificateStatus, setCertificateStatus] = useState<"all" | "active" | "expired">("all")
  const [certificateTrack, setCertificateTrack] = useState("all")
  const [certificatePage, setCertificatePage] = useState(1)
  const { toast } = useToast()

  const leaderboard = useQuery<StudentRow[]>({
    queryKey: ["admin", "leaderboard"],
    queryFn: () => fetchAdmin("/api/admin/leaderboard"),
    retry: false,
    enabled: canLoadAdminData,
  })

  const cohort = useQuery<LabInsightRow[]>({
    queryKey: ["admin", "lab-insights"],
    queryFn: () => fetchAdmin("/api/admin/lab-insights"),
    retry: false,
    enabled: canLoadAdminData && tab === "cohort",
  })

  const queryClient = useQueryClient()

  const sessions = useQuery<SessionRow[]>({
    queryKey: ["admin", "sessions"],
    queryFn: () => fetchAdmin("/api/admin/sessions"),
    retry: false,
    enabled: canLoadAdminData && tab === "sessions",
    refetchInterval: canLoadAdminData && tab === "sessions" ? 10_000 : false,
  })

  const pwResets = useQuery<PasswordResetRequest[]>({
    queryKey: ["admin", "password-resets"],
    queryFn: () => fetchAdmin("/api/admin/password-reset-requests"),
    retry: false,
    enabled: canLoadAdminData && tab === "password-resets",
    refetchInterval: canLoadAdminData && tab === "password-resets" ? 15_000 : false,
  })

  type RegSettings = { id: number; mode: string }
  type RegInvite = { id: number; email: string; createdAt: string; usedAt: string | null; expiresAt: string | null }
  type RegRequest = { id: number; name: string; email: string; status: string; createdAt: string }

  const regSettings = useQuery<RegSettings>({
    queryKey: ["admin", "registration"],
    queryFn: () => fetchAdmin("/api/admin/registration"),
    retry: false,
    enabled: canLoadAdminData && tab === "registration",
  })

  const regInvites = useQuery<RegInvite[]>({
    queryKey: ["admin", "registration", "invites"],
    queryFn: () => fetchAdmin("/api/admin/registration/invites"),
    retry: false,
    enabled: canLoadAdminData && tab === "registration",
  })

  const regRequests = useQuery<RegRequest[]>({
    queryKey: ["admin", "registration", "requests"],
    queryFn: () => fetchAdmin("/api/admin/registration/requests"),
    retry: false,
    enabled: canLoadAdminData && tab === "registration",
    refetchInterval: canLoadAdminData && tab === "registration" ? 20_000 : false,
  })

  type AuditEvent = { event: string; email: string; name: string | null; at: string }
  const regAudit = useQuery<AuditEvent[]>({
    queryKey: ["admin", "registration", "audit"],
    queryFn: () => fetchAdmin("/api/admin/registration/audit"),
    retry: false,
    enabled: canLoadAdminData && tab === "registration",
  })

  type AdminLabRow = { id: string; title: string; track: string; level: number | null; order: number; isRemote: boolean; active: boolean }
  const adminLabs = useQuery<AdminLabRow[]>({
    queryKey: ["admin", "labs"],
    queryFn: () => fetchAdmin("/api/admin/labs"),
    retry: false,
    enabled: canLoadAdminData && tab === "labs",
  })

  type OperationsOverview = {
    checkedAt: string
    api: { ok: boolean }
    database: { ok: boolean }
    docker: { ok: boolean }
    cleanup: {
      ok: boolean
      lastRun: {
        status: string
        deletedRows: number
        stoppedSessions: number
        errorMessage: string | null
        startedAt: string
        completedAt: string | null
      } | null
    }
    errors24h: number
    adminActions24h: number
    backups: {
      available: boolean
      policy: {
        retention: number
        schedule: string
        verification: string
      }
      current: {
        filename: string
        sizeBytes: number
        createdAt: string
        checksumPresent: boolean
      } | null
      message: string
    }
  }
  type AuditLogRow = {
    id: number
    actorEmail: string
    action: string
    statusCode: number
    createdAt: string
  }
  type ErrorEventRow = {
    id: number
    source: string
    message: string
    route: string | null
    statusCode: number | null
    createdAt: string
  }
  const operations = useQuery<OperationsOverview>({
    queryKey: ["admin", "operations", "overview"],
    queryFn: () => fetchAdmin("/api/admin/operations/overview"),
    retry: false,
    enabled: canLoadAdminData && tab === "operations",
    refetchInterval: canLoadAdminData && tab === "operations" ? 30_000 : false,
  })
  const auditLog = useQuery<AuditLogRow[]>({
    queryKey: ["admin", "operations", "audit"],
    queryFn: () => fetchAdmin("/api/admin/operations/audit?limit=25"),
    retry: false,
    enabled: canLoadAdminData && tab === "operations",
  })
  const errorEvents = useQuery<ErrorEventRow[]>({
    queryKey: ["admin", "operations", "errors"],
    queryFn: () => fetchAdmin("/api/admin/operations/errors"),
    retry: false,
    enabled: canLoadAdminData && tab === "operations",
  })
  const runBackup = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/operations/backups/run", { method: "POST" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? "Backup failed")
      return body
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "operations", "overview"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "operations", "audit"] })
      toast({ title: "Backup created and verified" })
    },
    onError: (err: Error) => toast({ title: "Backup failed", description: err.message, variant: "destructive" }),
  })
  const verifyBackup = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/operations/backups/verify", { method: "POST" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? "Backup verification failed")
      return body
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "operations", "overview"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "operations", "audit"] })
      toast({ title: "Backup verification passed" })
    },
    onError: (err: Error) => toast({ title: "Verification failed", description: err.message, variant: "destructive" }),
  })

  type CertRow = {
    certId: string
    studentId: string | null
    studentName: string
    showName: boolean
    track: string
    level: number | null
    earnedAt: string
    expiresAt: string
  }
  type CertificateResponse = {
    items: CertRow[]
    page: number
    pageSize: number
    total: number
    pageCount: number
    counts: { total: number; active: number; expired: number }
  }
  const certificates = useQuery<CertificateResponse>({
    queryKey: ["admin", "certificates", certificatePage, certificateSearch, certificateStatus, certificateTrack],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(certificatePage),
        pageSize: "25",
        status: certificateStatus,
        track: certificateTrack,
      })
      if (certificateSearch.trim()) params.set("search", certificateSearch.trim())
      return fetchAdmin(`/api/admin/certs?${params.toString()}`)
    },
    retry: false,
    enabled: canLoadAdminData && tab === "certificates",
    refetchInterval: canLoadAdminData && tab === "certificates" ? 30_000 : false,
  })

  type SummaryStats = { active_sessions: string; pending_requests: string; open_invites: string }
  const summary = useQuery<SummaryStats>({
    queryKey: ["admin", "summary"],
    queryFn: () => fetchAdmin("/api/admin/summary"),
    retry: false,
    enabled: canLoadAdminData,
    refetchInterval: canLoadAdminData ? 30_000 : false,
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
    mutationFn: async ({ email }: { email: string }) => {
      const res = await fetch("/api/admin/registration/invites", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error("Failed to add invite")
    },
    onSuccess: () => {
      setNewInviteEmail("")
      queryClient.invalidateQueries({ queryKey: ["admin", "registration", "invites"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "summary"] })
    },
  })

  const removeInvite = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/registration/invites/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to remove invite")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "registration", "invites"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "summary"] })
    },
  })

  const cleanupExpired = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/registration/invites/expired", { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to clean up")
      return res.json() as Promise<{ deleted: number }>
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "registration", "invites"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "summary"] })
      toast({ title: `Removed ${data.deleted} expired invite${data.deleted !== 1 ? "s" : ""}` })
    },
  })

  const approveRequest = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/registration/requests/${id}/approve`, { method: "POST" })
      if (!res.ok) throw new Error("Failed to approve request")
    },
    onSuccess: (_data, id) => {
      setSelectedRequestIds((prev) => { const next = new Set(prev); next.delete(id); return next })
      queryClient.invalidateQueries({ queryKey: ["admin", "registration", "requests"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "registration", "invites"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "summary"] })
    },
  })

  const bulkApprove = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await fetch("/api/admin/registration/requests/bulk-approve", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
      if (!res.ok) throw new Error("Failed to bulk approve")
      return res.json() as Promise<{ approved: number }>
    },
    onSuccess: (data) => {
      setSelectedRequestIds(new Set())
      queryClient.invalidateQueries({ queryKey: ["admin", "registration", "requests"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "registration", "invites"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "summary"] })
      toast({ title: `Approved ${data.approved} request${data.approved !== 1 ? "s" : ""}` })
    },
    onError: (err: Error) => toast({ title: "Bulk approve failed", description: err.message, variant: "destructive" }),
  })

  const toggleLabActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await fetch(`/api/admin/labs/${encodeURIComponent(id)}/active`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      })
      if (!res.ok) throw new Error("Failed to update lab")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "labs"] }),
    onError: (err: Error) => toast({ title: "Failed to update lab", description: err.message, variant: "destructive" }),
  })

  const refreshCertificate = useMutation({
    mutationFn: async (certId: string) => {
      const res = await fetch(`/api/admin/certs/${encodeURIComponent(certId)}/refresh`, { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Failed to refresh certificate")
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "certificates"] })
      toast({ title: "Certificate refreshed" })
    },
    onError: (err: Error) => toast({ title: "Cannot refresh certificate", description: err.message, variant: "destructive" }),
  })

  const syncCertificates = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/certs/backfill", { method: "POST" })
      if (!res.ok) throw new Error("Failed to sync certificates")
      return res.json() as Promise<{ upserted: number }>
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "certificates"] })
      toast({ title: `Synced ${data.upserted} certificate${data.upserted !== 1 ? "s" : ""}` })
    },
    onError: (err: Error) => toast({ title: "Cannot sync certificates", description: err.message, variant: "destructive" }),
  })

  const revokeCertificate = useMutation({
    mutationFn: async (certId: string) => {
      const res = await fetch(`/api/admin/certs/${encodeURIComponent(certId)}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to revoke certificate")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "certificates"] })
      toast({ title: "Certificate revoked" })
    },
    onError: (err: Error) => toast({ title: "Cannot revoke certificate", description: err.message, variant: "destructive" }),
  })

  const updateCertificatePrivacy = useMutation({
    mutationFn: async ({ certId, showName }: { certId: string; showName: boolean }) => {
      const res = await fetch(`/api/admin/certs/${encodeURIComponent(certId)}/privacy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showName }),
      })
      if (!res.ok) throw new Error("Failed to update certificate privacy")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "certificates"] })
      toast({ title: "Certificate privacy updated" })
    },
    onError: (err: Error) => toast({ title: "Cannot update certificate privacy", description: err.message, variant: "destructive" }),
  })

  const denyRequest = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/registration/requests/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to deny request")
    },
    onSuccess: (_data, id) => {
      setSelectedRequestIds((prev) => { const next = new Set(prev); next.delete(id); return next })
      queryClient.invalidateQueries({ queryKey: ["admin", "registration", "requests"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "registration", "audit"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "summary"] })
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "sessions"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "summary"] })
    },
  })

  const killIdle = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/sessions/idle", { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to kill idle sessions")
      return res.json() as Promise<{ killed: number }>
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "sessions"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "summary"] })
      toast({ title: `Killed ${data.killed} idle session${data.killed !== 1 ? "s" : ""}` })
    },
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

  const suspendAccount = useMutation({
    mutationFn: async (studentId: string) => {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(studentId)}/suspend`, { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Failed to suspend account")
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "leaderboard"] }),
    onError: (err: Error) => toast({ title: "Cannot suspend account", description: err.message, variant: "destructive" }),
  })

  const unsuspendAccount = useMutation({
    mutationFn: async (studentId: string) => {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(studentId)}/unsuspend`, { method: "POST" })
      if (!res.ok) throw new Error("Failed to unsuspend account")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "leaderboard"] }),
    onError: (err: Error) => toast({ title: "Cannot unsuspend account", description: err.message, variant: "destructive" }),
  })

  const labMeta = useMemo(() => {
    if (!labs) return {} as Record<string, { title: string; track: string; difficulty: string }>
    return Object.fromEntries(labs.map((l: any) => [l.id, { title: l.title, track: l.track, difficulty: l.difficulty ?? "" }]))
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

  if (isPending || adminAccess.isLoading) return null

  if (adminAccess.error || !adminAccess.data?.isAdmin) {
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
      <header className={cn(
        "sticky top-0 z-20 border-b transition-all duration-200 backdrop-blur-md",
        "bg-primary/8 border-primary/20",
        !scrolled && "dark:border-transparent"
      )}>
        <div className="px-6 py-4 flex items-center justify-between gap-4">

          {/* Left: back link + divider + brand */}
          <div className="flex items-center gap-4">
            <Link
              href={`${basePath}/dashboard`}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Link>

            <div className="w-px h-6 bg-border/50" />

            <div className="flex items-center gap-3">
              <img src={`${basePath}/logo.svg`} className="w-9 h-9 rounded-xl" alt="DevLabMaster" />
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-base tracking-tight leading-none">DevLabMaster</span>
                  <span className="text-xs font-bold tracking-widest uppercase px-2 py-0.5 rounded-md border border-white/60 text-foreground bg-white/30 dark:border-primary/40 dark:text-primary dark:bg-primary/10 leading-none">
                    Admin
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-none">Instructor Panel</p>
              </div>
            </div>
          </div>

          {/* Right: billing + account */}
          <div className="flex items-center gap-2">
            <Link
              href={`${basePath}/admin/billing`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-border/60 bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all duration-150"
            >
              <CreditCard className="w-4 h-4" />
              Billing
            </Link>
            <ThemeToggle />
            <NotificationBell />
            <AccountDropdown />
          </div>
        </div>
      </header>

      {/* ── Split pane body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Desktop admin navigation ── */}
        <aside className="hidden md:flex w-[238px] shrink-0 flex-col border-r border-border/50 bg-card/20">
          <div className="h-5 border-b border-border/40" />

          <nav aria-label="Admin sections" className="flex-1 overflow-y-auto p-3 space-y-1">
            <p className="px-3 pt-2 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/60">Workspace</p>
            {ADMIN_NAV.map(({ id, label, icon: Icon }) => {
              const pendingCount = id === "registration" ? Number(summary.data?.pending_requests ?? 0) : 0
              const active = tab === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTabAndHash(id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all duration-150",
                    active
                      ? "bg-primary/10 border border-primary/25 text-primary shadow-[0_0_18px_rgba(45,212,191,0.07)]"
                      : "border border-transparent text-muted-foreground hover:text-foreground hover:bg-primary/5",
                  )}
                >
                  <Icon className={cn("w-4 h-4 shrink-0", active ? "text-primary" : "text-muted-foreground/80")} />
                  <span className="flex-1">{label}</span>
                  {pendingCount > 0 && (
                    <span className="min-w-[19px] h-[19px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                      {pendingCount}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          <div className="p-4 border-t border-border/40">
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-3 py-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
              <div>
                <p className="text-[11px] font-semibold text-emerald-300">Admin access active</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Secure workspace</p>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main scrollable area ── */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto min-w-0">
          <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

            {/* ── Mobile navigation fallback ── */}
            <nav aria-label="Admin sections" className="md:hidden flex gap-1 p-1 rounded-xl bg-muted/30 border border-border/50 w-full overflow-x-auto">
              {ADMIN_NAV.map(({ id, label, icon: Icon }) => {
                const pendingCount = id === "registration" ? Number(summary.data?.pending_requests ?? 0) : 0
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTabAndHash(id)}
                    aria-current={tab === id ? "page" : undefined}
                    className={cn(
                      "shrink-0 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-all duration-150",
                      tab === id
                        ? "bg-primary/10 border border-primary/25 text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-primary/5",
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                    {pendingCount > 0 && (
                      <span className="min-w-[17px] h-[17px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                        {pendingCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Active Today",     value: activeToday,                                        sub: "in the last 24 hours",  icon: TrendingUp, color: "text-amber-400",  bg: "bg-amber-400/10",  border: "border-amber-400/20",  loading: leaderboard.isLoading },
                { label: "Active Sessions",  value: Number(summary.data?.active_sessions  ?? 0),        sub: "live lab containers",   icon: Activity,   color: "text-green-400",  bg: "bg-green-400/10",  border: "border-green-400/20",  loading: summary.isLoading },
                { label: "Pending Requests", value: Number(summary.data?.pending_requests ?? 0),        sub: "awaiting review",       icon: UserPlus,   color: "text-violet-400", bg: "bg-violet-400/10", border: "border-violet-400/20", loading: summary.isLoading },
                { label: "Open Invites",     value: Number(summary.data?.open_invites     ?? 0),        sub: "unused & not expired",  icon: MailPlus,   color: "text-cyan-400",   bg: "bg-cyan-400/10",   border: "border-cyan-400/20",   loading: summary.isLoading },
              ].map(({ label, value, sub, icon: Icon, color, bg, border, loading }) => (
                <div key={label} className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
                    <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center border", bg, border)}>
                      <Icon className={cn("w-4 h-4", color)} />
                    </div>
                  </div>
                  <div>
                    <p className={cn("text-3xl font-black font-mono leading-none", loading ? "text-muted-foreground/30" : "text-foreground")}>
                      {loading ? "—" : value}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                  </div>
                </div>
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
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
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
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Column headers */}
                      <div className="grid grid-cols-[2rem_1fr_auto_auto_1.5rem] gap-4 px-5 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
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
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-sm leading-tight truncate">{displayName(student)}</p>
                                  {student.banned && (
                                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-400 bg-amber-500/10">
                                      Suspended
                                    </span>
                                  )}
                                </div>
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
                                      "px-2 py-0.5 rounded-md text-xs font-mono border transition-colors",
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
                                <p className="text-xs text-muted-foreground mt-0.5">{relativeTime(student.last_active)}</p>
                              </div>
                              <ChevronRight className={cn("w-4 h-4 transition-all", isSelected ? "rotate-90 text-primary" : "text-muted-foreground/40 group-hover:text-muted-foreground")} />
                            </div>
                            {pct > 0 && (
                              <div className="mx-5 mb-3 h-1 rounded-full bg-muted/30 overflow-hidden">
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

            {/* ── Lab Insights (stats + ratings) ── */}
            {tab === "cohort" && (
              <div className="space-y-8">
                {cohort.isLoading && (
                  <div className="text-center py-20 text-muted-foreground text-sm animate-pulse">Loading lab insights…</div>
                )}
                {!cohort.isLoading && cohort.data?.length === 0 && (
                  <div className="text-center py-20 space-y-2">
                    <Target className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                    <p className="text-muted-foreground text-sm">No attempts recorded yet.</p>
                  </div>
                )}
                {cohort.data && cohort.data.length > 0 && (() => {
                  const byTrack: Record<string, LabInsightRow[]> = {}
                  for (const row of cohort.data) {
                    const track = labMeta[row.lab_id]?.track ?? "unknown"
                    ;(byTrack[track] ??= []).push(row)
                  }
                  return Object.entries(byTrack).map(([track, rows]) => {
                    const tm = TRACK_META[track] ?? DEFAULT_TRACK_META
                    const trackAttempts = rows.reduce((a, r) => a + r.attempted, 0)
                    const trackPassed   = rows.reduce((a, r) => a + r.passed,   0)
                    const trackRatings  = rows.reduce((a, r) => a + r.ratings,  0)
                    const trackHard     = rows.reduce((a, r) => a + r.hard,     0)
                    const avgRate = trackAttempts > 0 ? Math.round((trackPassed / trackAttempts) * 100) : 0
                    const avgColor = avgRate >= 80 ? "text-green-400" : avgRate >= 50 ? "text-amber-400" : "text-red-400"
                    const hardPct  = trackRatings  > 0 ? Math.round((trackHard  / trackRatings)  * 100) : 0
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
                          {trackRatings > 0 && <>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">{trackRatings} ratings · {hardPct}% hard</span>
                          </>}
                        </div>

                        {/* Column headers */}
                        <div className="grid grid-cols-[1fr_52px_52px_180px] gap-x-3 px-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          <span>Lab</span>
                          <span className="text-right">Tries</span>
                          <span className="text-right">Passed</span>
                          <span>Pass rate / Difficulty</span>
                        </div>

                        {/* Lab rows */}
                        <div>
                          {rows.map(row => {
                            const rate      = row.attempted > 0 ? Math.round((row.passed / row.attempted) * 100) : 0
                            const bc = rate >= 80 ? "bg-green-400" : rate >= 50 ? "bg-amber-400" : "bg-red-400"
                            const tc = rate >= 80 ? "text-green-400" : rate >= 50 ? "text-amber-400" : "text-red-400"
                            const r  = row.ratings
                            return (
                              <div key={row.lab_id} className="grid grid-cols-[1fr_52px_52px_180px] gap-x-3 items-center px-3 py-2.5 rounded-lg hover:bg-muted/20 transition-colors">
                                <p className="text-sm truncate text-foreground/90">{labMeta[row.lab_id]?.title ?? row.lab_id}</p>
                                <span className="text-sm font-mono text-right text-muted-foreground">{row.attempted}</span>
                                <span className="text-sm font-mono text-right text-foreground">{row.passed}</span>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                                    <div
                                      className={cn("h-full rounded-full", (() => {
                                        // Colour = dominant difficulty from ratings; fall back to lab difficulty field
                                        if (r > 0) {
                                          if (row.hard >= row.easy && row.hard >= row.ok) return "bg-red-400"
                                          if (row.ok  >= row.easy && row.ok  >= row.hard) return "bg-amber-400"
                                          return "bg-green-400"
                                        }
                                        const d = labMeta[row.lab_id]?.difficulty ?? ""
                                        return d === "advanced" ? "bg-red-400" : d === "intermediate" ? "bg-amber-400" : "bg-green-400"
                                      })())}
                                      style={{ width: `${rate}%` }}
                                    />
                                  </div>
                                  <span className={cn("text-xs font-bold font-mono w-8 text-right shrink-0", tc)}>{rate}%</span>
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
                    <div className="flex items-center justify-between px-1 pb-1">
                      <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex-1">
                        <span>Student</span><span>Lab</span><span className="w-20 text-center">Status</span><span className="w-16" />
                      </div>
                      <button
                        disabled={killIdle.isPending}
                        onClick={() => killIdle.mutate()}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium shrink-0"
                      >
                        {killIdle.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                        Kill idle (&gt;30 min)
                      </button>
                    </div>
                    {sessions.data.map((s: SessionRow) => {
                      const labTitle = labMeta[s.lab_id]?.title ?? s.lab_id
                      const trackMeta = labMeta[s.lab_id] ? TRACK_META[labMeta[s.lab_id].track] : null
                      const studentLabel = s.name ?? s.email?.split("@")[0] ?? s.student_id.slice(0, 8)
                      const isKilling = killSession.isPending && (killSession.variables as any)?.studentId === s.student_id && (killSession.variables as any)?.labId === s.lab_id
                      return (
                        <div key={`${s.student_id}:${s.lab_id}`} className="rounded-xl border border-border/50 bg-card/60 px-5 py-4 grid grid-cols-[1fr_1fr_auto_auto] gap-4 items-center">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{studentLabel}</p>
                            {s.email && s.name && <p className="text-xs text-muted-foreground truncate">{s.email}</p>}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm truncate">{labTitle}</p>
                            {trackMeta && (
                              <div className={cn("inline-flex items-center gap-1 mt-0.5 text-xs font-semibold", trackMeta.accentClass)}>
                                <trackMeta.icon className="w-3 h-3" />{trackMeta.label}
                              </div>
                            )}
                          </div>
                          <div className="w-20 flex justify-center">
                            <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border",
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
                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
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
                            <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border",
                              r.status === "pending"                   ? "text-amber-400 border-amber-500/30 bg-amber-500/10" :
                              r.status === "approved" && !tokenExpired ? "text-green-400 border-green-500/30 bg-green-500/10" :
                              r.status === "approved" && tokenExpired  ? "text-orange-400 border-orange-500/30 bg-orange-500/10" :
                                                                         "text-muted-foreground border-border bg-muted/20",
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
                                  : "border-border/40 bg-card hover:bg-muted/40 hover:border-border text-muted-foreground",
                              )}
                            >
                              <Icon className={cn("w-4 h-4", isActive ? icon_active : "text-muted-foreground/60")} />
                              <div>
                                <p className={cn("text-xs font-semibold", isActive ? "" : "text-foreground/70")}>{label}</p>
                                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{desc}</p>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )
                  }
                </div>

                {/* ── Approved emails + Account requests side by side ── */}
                <div className="grid grid-cols-2 gap-0 items-start divide-x divide-border bg-card border border-border/50 rounded-xl px-6 py-5 mt-2">

                {/* ── Approved emails (invites) ── */}
                <div className="space-y-3 pr-6">
                  <div className="flex items-center gap-2">
                    <MailPlus className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-semibold">Approved emails</p>
                    {!regInvites.isLoading && (regInvites.data?.length ?? 0) > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted/40 border border-border/50 text-muted-foreground font-medium">
                        {regInvites.data!.length}
                      </span>
                    )}
                    {(() => {
                      const expiredCount = regInvites.data?.filter(
                        inv => inv.expiresAt && !inv.usedAt && new Date(inv.expiresAt) < new Date()
                      ).length ?? 0
                      return expiredCount > 0 ? (
                        <button
                          onClick={() => cleanupExpired.mutate()}
                          disabled={cleanupExpired.isPending}
                          className="ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-red-500/30 text-red-400 bg-red-500/8 hover:bg-red-500/15 disabled:opacity-40 transition-colors font-semibold"
                        >
                          {cleanupExpired.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          Clean up {expiredCount} expired
                        </button>
                      ) : null
                    })()}
                  </div>

                  <form
                    onSubmit={e => { e.preventDefault(); if (newInviteEmail) addInvite.mutate({ email: newInviteEmail }) }}
                    className="flex gap-2"
                  >
                    <input
                      type="email"
                      placeholder="student@example.com"
                      value={newInviteEmail}
                      onChange={e => setNewInviteEmail(e.target.value)}
                      className="flex-1 min-w-0 bg-transparent border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
                    />
                    <button
                      type="submit"
                      disabled={addInvite.isPending || !newInviteEmail}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
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
                      {regInvites.data.map((inv: RegInvite) => {
                        const isExpired = !inv.usedAt && !!inv.expiresAt && new Date(inv.expiresAt) < new Date()
                        return (
                          <div key={inv.id} className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg group hover:bg-muted/20 transition-colors",
                            (inv.usedAt || isExpired) && "opacity-50"
                          )}>
                            <div className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                              inv.usedAt ? "bg-muted/30 text-muted-foreground" : isExpired ? "bg-red-500/15 text-red-400" : "bg-primary/15 text-primary"
                            )}>
                              {inv.email.charAt(0).toUpperCase()}
                            </div>
                            <span className="flex-1 text-sm truncate">{inv.email}</span>
                            {inv.usedAt
                              ? <span className="text-xs px-2 py-0.5 rounded-full border border-green-500/20 text-green-400 bg-green-500/8 font-medium shrink-0">registered</span>
                              : isExpired
                              ? <span className="text-xs px-2 py-0.5 rounded-full border border-red-500/20 text-red-400 bg-red-500/8 font-medium shrink-0">expired</span>
                              : <span className="text-xs px-2 py-0.5 rounded-full border border-border/40 text-muted-foreground bg-muted/10 font-medium shrink-0">pending</span>
                            }
                            {inv.expiresAt && !inv.usedAt && !isExpired && (
                              <span className="text-xs text-muted-foreground/60 font-mono shrink-0">
                                {(() => {
                                  const ms = new Date(inv.expiresAt).getTime() - Date.now()
                                  const h = Math.ceil(ms / 3_600_000)
                                  return h < 24 ? `exp ${h}h` : `exp ${Math.ceil(h / 24)}d`
                                })()}
                              </span>
                            )}
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
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* ── Account requests ── */}
                <div className="space-y-3 pl-6">
                  {(() => {
                    const pending = regRequests.data?.filter((r: { status: string }) => r.status === "pending") ?? []
                    const allPendingSelected = pending.length > 0 && pending.every((r: { id: number }) => selectedRequestIds.has(r.id))
                    return (
                      <>
                        <div className="flex items-center gap-2">
                          <UserPlus className="w-4 h-4 text-muted-foreground" />
                          <p className="text-sm font-semibold">Account requests</p>
                          {!regRequests.isLoading && (regRequests.data?.length ?? 0) > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted/40 border border-border/50 text-muted-foreground font-medium">
                              {regRequests.data!.length}
                            </span>
                          )}
                          {pending.length > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-semibold">
                              {pending.length} pending
                            </span>
                          )}
                          {selectedRequestIds.size > 0 && (
                            <button
                              onClick={() => bulkApprove.mutate([...selectedRequestIds])}
                              disabled={bulkApprove.isPending}
                              className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 disabled:opacity-40 transition-colors font-semibold"
                            >
                              {bulkApprove.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
                              Approve selected ({selectedRequestIds.size})
                            </button>
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
                            {/* Select-all row */}
                            {pending.length > 1 && (
                              <div className="flex items-center gap-3 px-3 py-1.5">
                                <input
                                  type="checkbox"
                                  checked={allPendingSelected}
                                  onChange={(e) => {
                                    const next = new Set(selectedRequestIds)
                                    if (e.target.checked) pending.forEach((r: { id: number }) => next.add(r.id))
                                    else pending.forEach((r: { id: number }) => next.delete(r.id))
                                    setSelectedRequestIds(next)
                                  }}
                                  className="w-3.5 h-3.5 rounded accent-green-500 cursor-pointer"
                                />
                                <span className="text-xs text-muted-foreground">Select all pending</span>
                              </div>
                            )}
                            {regRequests.data.map((r: { id: number; name: string; email: string; status: string; createdAt: string }) => (
                              <div key={r.id} className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/20 transition-colors",
                                r.status !== "pending" && "opacity-50"
                              )}>
                                {r.status === "pending" ? (
                                  <input
                                    type="checkbox"
                                    checked={selectedRequestIds.has(r.id)}
                                    onChange={(e) => {
                                      const next = new Set(selectedRequestIds)
                                      if (e.target.checked) next.add(r.id); else next.delete(r.id)
                                      setSelectedRequestIds(next)
                                    }}
                                    className="w-3.5 h-3.5 rounded accent-green-500 cursor-pointer shrink-0"
                                  />
                                ) : (
                                  <div className="w-3.5 h-3.5 shrink-0" />
                                )}
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
                                  "text-xs px-2 py-0.5 rounded-full border font-semibold shrink-0",
                                  r.status === "pending"  ? "text-amber-400 border-amber-500/30 bg-amber-500/10" :
                                  r.status === "approved" ? "text-green-400 border-green-500/30 bg-green-500/10" :
                                                            "text-muted-foreground border-border bg-muted/20",
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
                                      onClick={() => setConfirmDenyRequest({ id: r.id, name: r.name, email: r.email })}
                                      disabled={denyRequest.isPending && denyRequest.variables === r.id}
                                      title="Deny"
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
                      </>
                    )
                  })()}
                </div>

                </div>{/* end side-by-side grid */}

                {/* ── Audit log ── */}
                <div className="border-t border-border/50 pt-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-semibold">Activity log</p>
                    {!regAudit.isLoading && (regAudit.data?.length ?? 0) > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted/40 border border-border/50 text-muted-foreground font-medium">
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
                            <span className="text-xs font-semibold text-muted-foreground w-20 shrink-0">{cfg.label}</span>
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

            {/* ── Certificates ── */}
            {tab === "certificates" && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Award className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-semibold">Certificate registry</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Search, review, refresh, and revoke issued records.</p>
                  </div>
                  <button
                    disabled={syncCertificates.isPending}
                    onClick={() => syncCertificates.mutate()}
                    className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium shrink-0"
                  >
                    {syncCertificates.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    Sync completed
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total", value: certificates.data?.counts.total, color: "text-foreground" },
                    { label: "Active", value: certificates.data?.counts.active, color: "text-emerald-400" },
                    { label: "Expired", value: certificates.data?.counts.expired, color: "text-amber-400" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl border border-border/50 bg-card/60 px-4 py-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
                      <p className={cn("text-2xl font-black font-mono mt-1", color)}>{certificates.isLoading ? "—" : value ?? 0}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search learner, certificate ID, or track…"
                      value={certificateSearch}
                      onChange={e => { setCertificateSearch(e.target.value); setCertificatePage(1) }}
                      className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50"
                    />
                  </div>
                  <select
                    value={certificateStatus}
                    onChange={e => { setCertificateStatus(e.target.value as typeof certificateStatus); setCertificatePage(1) }}
                    className="px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary/50"
                    aria-label="Certificate status"
                  >
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                  </select>
                  <select
                    value={certificateTrack}
                    onChange={e => { setCertificateTrack(e.target.value); setCertificatePage(1) }}
                    className="px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary/50"
                    aria-label="Certificate track"
                  >
                    <option value="all">All tracks</option>
                    {Object.entries(TRACK_META).filter(([, meta]) => !meta.comingSoon).map(([value, meta]) => (
                      <option key={value} value={value}>{meta.label}</option>
                    ))}
                  </select>
                </div>
                {certificates.isLoading && (
                  <div className="text-center py-20 text-muted-foreground font-mono text-sm animate-pulse">Loading certificates…</div>
                )}
                {certificates.error && (
                  <div className="text-center py-20 text-red-400 font-mono text-sm">Failed to load certificates.</div>
                )}
                {!certificates.isLoading && !certificates.error && certificates.data?.items.length === 0 && (
                  <div className="text-center py-20 space-y-2">
                    <Award className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                    <p className="text-muted-foreground text-sm">
                      {certificateSearch || certificateStatus !== "all" || certificateTrack !== "all"
                        ? "No certificates match these filters."
                        : "No certificates have been issued yet."}
                    </p>
                  </div>
                )}
                {certificates.data && certificates.data.items.length > 0 && (
                  <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
                    <div className="hidden lg:grid grid-cols-[minmax(170px,1.25fr)_minmax(150px,1fr)_100px_120px_90px_92px] gap-4 px-4 py-2.5 border-b border-border/50 bg-muted/20 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <span>Learner</span>
                      <span>Certificate</span>
                      <span>Issued</span>
                      <span>Expires</span>
                      <span>Status</span>
                      <span className="text-right">Actions</span>
                    </div>
                    {certificates.data.items.map(cert => {
                      const track = TRACK_META[cert.track] ?? DEFAULT_TRACK_META
                      const expired = new Date(cert.expiresAt) < new Date()
                      const refreshing = refreshCertificate.isPending && refreshCertificate.variables === cert.certId
                      const revoking = revokeCertificate.isPending && revokeCertificate.variables === cert.certId
                      const formattedId = cert.certId.match(/.{1,4}/g)?.join("-") ?? cert.certId
                      return (
                        <div key={cert.certId} className="grid grid-cols-1 lg:grid-cols-[minmax(170px,1.25fr)_minmax(150px,1fr)_100px_120px_90px_92px] gap-3 lg:gap-4 lg:items-center px-4 py-3 border-b border-border/30 last:border-b-0 hover:bg-muted/15 transition-colors">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", track.bgClass)}>
                                <Award className={cn("w-3.5 h-3.5", track.accentClass)} />
                              </div>
                              <p className="text-sm font-semibold truncate">{cert.studentName}</p>
                            </div>
                            <p className="text-[10px] text-muted-foreground/60 font-mono mt-1 truncate lg:pl-9">{formattedId}</p>
                          </div>
                          <div className="min-w-0 flex items-center justify-between lg:block">
                            <div>
                              <span className="lg:hidden text-[10px] uppercase tracking-wider text-muted-foreground">Certificate</span>
                              <p className="text-xs font-medium truncate">{track.label}</p>
                              <p className="text-[11px] text-muted-foreground">{cert.level == null ? "Full track" : `Level ${cert.level}`}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between lg:block">
                            <span className="lg:hidden text-[10px] uppercase tracking-wider text-muted-foreground">Issued</span>
                            <p className="text-xs text-muted-foreground">{new Date(cert.earnedAt).toLocaleDateString()}</p>
                          </div>
                          <div className="flex items-center justify-between lg:block">
                            <span className="lg:hidden text-[10px] uppercase tracking-wider text-muted-foreground">Expires</span>
                            <p className={cn("text-xs", expired ? "text-amber-400" : "text-muted-foreground")}>
                              {new Date(cert.expiresAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center justify-between lg:block">
                            <span className="lg:hidden text-[10px] uppercase tracking-wider text-muted-foreground">Status</span>
                            <span className={cn(
                              "inline-flex text-[10px] px-1.5 py-0.5 rounded-full border font-semibold uppercase tracking-wide",
                              expired
                                ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
                                : "text-green-400 border-green-500/30 bg-green-500/10",
                            )}>
                              {expired ? "expired" : "active"}
                            </span>
                          </div>
                          <div className="flex items-center justify-end gap-1.5 border-t border-border/30 pt-2 lg:border-0 lg:pt-0">
                            <a
                              href={`${basePath}/verify/${cert.certId}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Open public verification"
                              aria-label={`Open public verification for ${cert.studentName}`}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/10 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button
                              disabled={refreshing || revoking}
                              onClick={() => refreshCertificate.mutate(cert.certId)}
                              title="Refresh certificate"
                              aria-label={`Refresh certificate for ${cert.studentName}`}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              disabled={refreshing || revoking}
                              onClick={() => {
                                if (window.confirm(`Revoke ${cert.studentName}'s certificate?`)) revokeCertificate.mutate(cert.certId)
                              }}
                              title="Revoke certificate"
                              aria-label={`Revoke certificate for ${cert.studentName}`}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              {revoking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              disabled={refreshing || revoking || updateCertificatePrivacy.isPending}
                              onClick={() => updateCertificatePrivacy.mutate({ certId: cert.certId, showName: !cert.showName })}
                              title={cert.showName ? "Hide learner name publicly" : "Show learner name publicly"}
                              aria-label={`${cert.showName ? "Hide" : "Show"} learner name for ${cert.studentName}`}
                              className={cn(
                                "inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                                cert.showName
                                  ? "border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                                  : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10",
                              )}
                            >
                              {cert.showName ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border/50 bg-muted/10 flex-wrap">
                      <p className="text-xs text-muted-foreground">
                        Showing {((certificates.data.page - 1) * certificates.data.pageSize) + 1}–{Math.min(certificates.data.page * certificates.data.pageSize, certificates.data.total)} of {certificates.data.total}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={certificatePage <= 1 || certificates.isFetching}
                          onClick={() => setCertificatePage(page => page - 1)}
                          className="px-3 py-1.5 text-xs rounded-lg border border-border/60 hover:border-primary/40 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <span className="text-xs text-muted-foreground font-mono">{certificates.data.page} / {certificates.data.pageCount}</span>
                        <button
                          disabled={certificatePage >= certificates.data.pageCount || certificates.isFetching}
                          onClick={() => setCertificatePage(page => page + 1)}
                          className="px-3 py-1.5 text-xs rounded-lg border border-border/60 hover:border-primary/40 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Operations ── */}
            {tab === "operations" && (
              <div className="space-y-5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">Product safety & operations</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Live readiness checks for the API, database, Docker, cleanup, backups, and audit telemetry.</p>
                  </div>
                </div>

                {operations.isLoading && (
                  <div className="text-center py-16 text-muted-foreground text-sm animate-pulse">Checking production readiness…</div>
                )}
                {operations.error && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400">Unable to load operations health.</div>
                )}
                {operations.data && (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {[
                        { label: "API", ok: operations.data.api.ok, icon: Server },
                        { label: "Database", ok: operations.data.database.ok, icon: Database },
                        { label: "Docker", ok: operations.data.docker.ok, icon: Beaker },
                        { label: "Cleanup", ok: operations.data.cleanup.ok, icon: RotateCcw },
                      ].map(({ label, ok, icon: Icon }) => (
                        <div key={label} className="rounded-xl border border-border/50 bg-card/60 px-4 py-3 flex items-center gap-3">
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", ok ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400")}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold">{label}</p>
                            <p className={cn("text-[10px] uppercase tracking-wider font-bold", ok ? "text-emerald-400" : "text-red-400")}>{ok ? "Healthy" : "Attention"}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid lg:grid-cols-3 gap-4">
                      <div className="rounded-xl border border-border/50 bg-card/60 p-4">
                        <div className="flex items-center gap-2 mb-3"><History className="w-4 h-4 text-primary" /><p className="text-sm font-semibold">Cleanup monitor</p></div>
                        <p className="text-xs text-muted-foreground">
                          {operations.data.cleanup.lastRun?.completedAt
                            ? `Last run ${relativeTime(operations.data.cleanup.lastRun.completedAt)}`
                            : "No completed cleanup run recorded"}
                        </p>
                        {operations.data.cleanup.lastRun && (
                          <p className="text-xs text-muted-foreground/70 mt-2">
                            Removed {operations.data.cleanup.lastRun.deletedRows} rows · stopped {operations.data.cleanup.lastRun.stoppedSessions} sessions
                          </p>
                        )}
                      </div>
                      <div className="rounded-xl border border-border/50 bg-card/60 p-4">
                        <div className="flex items-center gap-2 mb-3"><Database className="w-4 h-4 text-cyan-400" /><p className="text-sm font-semibold">Backup strategy</p></div>
                        <p className="text-xs text-muted-foreground">{operations.data.backups.message}</p>
                        <p className="text-[11px] text-muted-foreground/70 mt-2">
                          Daily at {operations.data.backups.policy.schedule} · retains {operations.data.backups.policy.retention} backup
                        </p>
                        {operations.data.backups.current ? (
                          <div className="mt-3 rounded-lg border border-border/50 bg-background/30 p-2.5">
                            <p className="text-[11px] font-mono truncate">{operations.data.backups.current.filename}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {(operations.data.backups.current.sizeBytes / 1024 / 1024).toFixed(2)} MB · {relativeTime(operations.data.backups.current.createdAt)} · checksum {operations.data.backups.current.checksumPresent ? "ready" : "missing"}
                            </p>
                          </div>
                        ) : (
                          <p className="text-[11px] text-amber-400 mt-3">No completed backup found.</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-3">
                          <button
                            type="button"
                            disabled={!operations.data.backups.available || runBackup.isPending || verifyBackup.isPending}
                            onClick={() => runBackup.mutate()}
                            className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {runBackup.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                            Run backup now
                          </button>
                          <button
                            type="button"
                            disabled={!operations.data.backups.available || !operations.data.backups.current || runBackup.isPending || verifyBackup.isPending}
                            onClick={() => verifyBackup.mutate()}
                            className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {verifyBackup.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                            Verify current
                          </button>
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-card/60 p-4">
                        <div className="flex items-center gap-2 mb-3"><Bug className="w-4 h-4 text-amber-400" /><p className="text-sm font-semibold">Telemetry, last 24h</p></div>
                        <div className="flex items-end gap-5">
                          <div><p className="text-2xl font-black font-mono">{operations.data.errors24h}</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">errors</p></div>
                          <div><p className="text-2xl font-black font-mono">{operations.data.adminActions24h}</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">admin actions</p></div>
                        </div>
                      </div>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
                        <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2"><History className="w-4 h-4 text-primary" /><p className="text-sm font-semibold">Recent admin actions</p></div>
                        {auditLog.isLoading && <p className="p-4 text-xs text-muted-foreground animate-pulse">Loading audit log…</p>}
                        {!auditLog.isLoading && !auditLog.data?.length && <p className="p-4 text-xs text-muted-foreground">No mutating admin actions recorded yet.</p>}
                        {auditLog.data?.map(row => (
                          <div key={row.id} className="px-4 py-2.5 border-b border-border/30 last:border-0 flex items-center gap-3">
                            <span className={cn("w-2 h-2 rounded-full shrink-0", row.statusCode < 400 ? "bg-emerald-400" : "bg-red-400")} />
                            <div className="min-w-0 flex-1"><p className="text-xs font-medium truncate">{row.action}</p><p className="text-[10px] text-muted-foreground truncate">{row.actorEmail}</p></div>
                            <span className="text-[10px] text-muted-foreground font-mono shrink-0">{relativeTime(row.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
                        <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2"><Bug className="w-4 h-4 text-amber-400" /><p className="text-sm font-semibold">Recent errors</p></div>
                        {errorEvents.isLoading && <p className="p-4 text-xs text-muted-foreground animate-pulse">Loading error events…</p>}
                        {!errorEvents.isLoading && !errorEvents.data?.length && <p className="p-4 text-xs text-muted-foreground">No retained errors.</p>}
                        {errorEvents.data?.slice(0, 8).map(row => (
                          <div key={row.id} className="px-4 py-2.5 border-b border-border/30 last:border-0">
                            <div className="flex items-center justify-between gap-3"><span className="text-[10px] uppercase tracking-wider text-amber-400">{row.source}</span><span className="text-[10px] text-muted-foreground">{relativeTime(row.createdAt)}</span></div>
                            <p className="text-xs mt-1 truncate">{row.message}</p>
                            {row.route && <p className="text-[10px] text-muted-foreground font-mono truncate">{row.statusCode ?? "—"} {row.route}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}


            {/* ── Labs ── */}
            {tab === "labs" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Beaker className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Lab visibility</p>
                  <span className="text-xs text-muted-foreground">— toggle to hide a broken lab from students without a code deploy</span>
                  <div className="ml-auto flex items-center gap-2 min-w-[200px] relative">
                    <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground/60 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search labs…"
                      value={labSearch}
                      onChange={e => setLabSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50"
                    />
                  </div>
                </div>
                {adminLabs.isLoading && (
                  <div className="text-center py-20 text-muted-foreground text-sm animate-pulse">Loading labs…</div>
                )}
                {!adminLabs.isLoading && (adminLabs.data?.length ?? 0) === 0 && (
                  <div className="text-center py-20 space-y-2">
                    <Beaker className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                    <p className="text-muted-foreground text-sm">No labs found.</p>
                  </div>
                )}
                {adminLabs.data && adminLabs.data.length > 0 && (() => {
                  const q = labSearch.trim().toLowerCase()
                  const filtered = q ? adminLabs.data!.filter(l => l.title.toLowerCase().includes(q)) : adminLabs.data!
                  if (q && filtered.length === 0) return (
                    <div className="text-center py-12 text-muted-foreground text-sm">No labs match &ldquo;{labSearch}&rdquo;</div>
                  )
                  const byTrack: Record<string, typeof filtered> = {}
                  for (const lab of filtered) {
                    ;(byTrack[lab.track] ??= []).push(lab)
                  }
                  return Object.entries(byTrack).map(([track, trackLabs]) => {
                    const tm = TRACK_META[track] ?? DEFAULT_TRACK_META
                    const byLevel: Record<string, typeof trackLabs> = {}
                    for (const lab of trackLabs) {
                      const key = lab.level != null ? String(lab.level) : "—"
                      ;(byLevel[key] ??= []).push(lab)
                    }
                    return (
                      <div key={track} className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
                        {/* Track header */}
                        <div className="flex items-center gap-3 px-5 py-4 bg-muted/20 border-b border-border/50">
                          <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", tm.bgClass)}>
                            <tm.icon className={cn("w-3.5 h-3.5", tm.accentClass)} />
                          </div>
                          <p className={cn("text-sm font-bold tracking-wide", tm.accentClass)}>{tm.label}</p>
                          <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-muted/40 border border-border/40 text-muted-foreground">{trackLabs.length} labs</span>
                        </div>
                        {/* Level groups */}
                        <div className="divide-y divide-border/30">
                          {Object.entries(byLevel).sort(([a], [b]) => (a === "—" ? 1 : b === "—" ? -1 : Number(a) - Number(b))).map(([level, labs]) => {
                            const key = `${track}:${level}`
                            const open = openLevels.has(key) || q.length > 0
                            const toggle = () => setOpenLevels(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s })
                            const onlineCount = labs.filter(l => l.active).length
                            return (
                              <div key={key}>
                                <button onClick={toggle} className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/10 transition-colors group">
                                  <ChevronRight className={cn("w-3.5 h-3.5 text-muted-foreground/40 transition-transform duration-150 group-hover:text-muted-foreground", open && "rotate-90")} />
                                  <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">{level === "—" ? "No level" : `Level ${level}`}</span>
                                  <span className="text-xs text-muted-foreground/40 font-medium">{labs.length} labs</span>
                                  <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-muted-foreground/60">
                                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", onlineCount === labs.length ? "bg-green-400/70" : onlineCount === 0 ? "bg-red-400/60" : "bg-amber-400/70")} />
                                    {onlineCount}/{labs.length} online
                                  </span>
                                </button>
                                {open && (
                                  <div className="divide-y divide-border/20 bg-background/40">
                                    {labs.sort((a, b) => a.order - b.order).map((lab) => (
                                      <div key={lab.id} className="flex items-center gap-4 px-5 py-2 hover:bg-muted/10 transition-colors">
                                        <div className="flex-1 min-w-0">
                                          <p className={cn("text-sm font-medium truncate", !lab.active ? "text-muted-foreground/60" : "text-foreground/90")}>{lab.title}</p>
                                        </div>
                                        {!lab.isRemote && (
                                          <span className="text-xs px-2 py-0.5 rounded-full border border-border/40 text-muted-foreground/60 bg-muted/20 shrink-0">built-in</span>
                                        )}
                                        {toggleLabActive.isPending && toggleLabActive.variables?.id === lab.id ? (
                                          <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 text-muted-foreground">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                          </span>
                                        ) : lab.active ? (
                                          <button
                                            onClick={() => toggleLabActive.mutate({ id: lab.id, active: false })}
                                            disabled={!lab.isRemote}
                                            title={!lab.isRemote ? "Built-in labs cannot be disabled" : "Take offline"}
                                            className={cn(
                                              "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-semibold shrink-0 transition-colors",
                                              !lab.isRemote
                                                ? "opacity-30 cursor-not-allowed border-border text-muted-foreground"
                                                : "border-green-500/30 bg-green-500/10 text-green-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400",
                                            )}
                                          >
                                            <Eye className="w-3 h-3" /> Online
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => toggleLabActive.mutate({ id: lab.id, active: true })}
                                            title="Bring online"
                                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-semibold shrink-0 transition-colors border-red-500/30 bg-red-500/10 text-red-400 hover:bg-green-500/10 hover:border-green-500/30 hover:text-green-400"
                                          >
                                            <EyeOff className="w-3 h-3" /> Offline
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
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


          </div>{/* end inner padding */}
        </div>{/* end scroll area */}

        {/* ── Student detail panel — inline sidebar ── */}
        {selectedStudent && (
          <div
            className="w-96 shrink-0 border-l border-border bg-card shadow-2xl flex flex-col overflow-hidden"
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
                    <p className="text-xs text-muted-foreground/60 mt-0.5">Active {relativeTime(selectedStudent.last_active)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="shrink-0 w-7 h-7 rounded-lg hover:bg-muted/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors mt-0.5"
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
                <div key={label} className="bg-muted/50 px-2 py-3.5 text-center">
                  <p className="text-lg font-black font-mono text-foreground leading-none">{value}</p>
                  <p className="text-[9px] text-muted-foreground/60 mt-0.5 uppercase tracking-wider">{sub}</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide mt-1 font-semibold">{label}</p>
                </div>
              ))}
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">

              {/* Track progress */}
              <div className="px-5 pt-5 pb-5 border-b border-border/40">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/60 mb-4">Progress by Track</p>
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
                            {inProgress > 0 && <span className="text-xs text-muted-foreground">{inProgress} in progress</span>}
                            <span className="text-xs font-mono text-muted-foreground">
                              <span className={passed > 0 ? meta.accentClass : ""}>{passed}</span>/{total}
                            </span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: meta.accentHex }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Lab attempts */}
              <div className="px-5 pt-5 pb-5">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/60 mb-4">Lab Attempts</p>
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
                          <div className={cn("flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-2", meta.accentClass)}>
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
                                  <span className="shrink-0 text-xs font-mono font-bold text-green-400">{l.bestScore}%</span>
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
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-red-400/60 mb-3">Danger Zone</p>
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
                {selectedStudent.banned ? (
                  <button
                    disabled={unsuspendAccount.isPending && unsuspendAccount.variables === selectedStudent.id}
                    onClick={() => unsuspendAccount.mutate(selectedStudent.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2.5 rounded-xl border border-green-500/30 text-green-400 hover:bg-green-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold"
                  >
                    {unsuspendAccount.isPending && unsuspendAccount.variables === selectedStudent.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                    Unsuspend
                  </button>
                ) : (
                  <button
                    disabled={suspendAccount.isPending && suspendAccount.variables === selectedStudent.id}
                    onClick={() => suspendAccount.mutate(selectedStudent.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2.5 rounded-xl border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold"
                  >
                    {suspendAccount.isPending && suspendAccount.variables === selectedStudent.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                    Suspend
                  </button>
                )}
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

      {confirmDenyRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                <X className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="font-bold text-base">Deny registration request?</h2>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  The request from <span className="font-semibold text-foreground">{confirmDenyRequest.name}</span>
                  {" "}(<span className="font-mono text-xs">{confirmDenyRequest.email}</span>) will be permanently removed.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2.5">
              <button onClick={() => setConfirmDenyRequest(null)} className="px-4 py-2.5 text-sm rounded-xl border border-border hover:bg-muted/50 transition-colors font-medium">Cancel</button>
              <button
                onClick={() => { denyRequest.mutate(confirmDenyRequest.id); setConfirmDenyRequest(null) }}
                className="px-4 py-2.5 text-sm rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
              >Deny request</button>
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
