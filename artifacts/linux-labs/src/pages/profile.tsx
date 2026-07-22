import { useState, useEffect, useMemo } from "react"
import { Link, useLocation } from "wouter"
import { useSession, signOut, authClient } from "@/lib/auth-client"
import { useQuery } from "@tanstack/react-query"
import { useListLabs, useListProgress } from "@workspace/api-client-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Zap, ArrowLeft, Loader2, CheckCircle2, User, Mail, Lock, Chrome, Award, Trash2, AlertTriangle } from "lucide-react"
import { AccountDropdown } from "@/components/account-dropdown"
import { TRACK_META, DEFAULT_TRACK_META } from "@/lib/track-meta"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

export default function ProfilePage() {
  const { data: session, isPending } = useSession()
  const [, setLocation] = useLocation()

  // Name update
  const [name, setName] = useState("")
  const [nameLoading, setNameLoading] = useState(false)
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Password change
  const [currentPwd, setCurrentPwd] = useState("")
  const [newPwd, setNewPwd]         = useState("")
  const [confirmPwd, setConfirmPwd] = useState("")
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdMsg, setPwdMsg]         = useState<{ ok: boolean; text: string } | null>(null)

  // Account deletion
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0) // 0=hidden, 1=confirm, 2=typing
  const [deleteInput, setDeleteInput] = useState("")
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const user = session?.user

  // Progress data
  const { data: labs } = useListLabs()
  const { data: progress } = useListProgress()

  const trackStats = useMemo(() => {
    if (!labs || !progress) return []
    const byLabId = Object.fromEntries(
      (progress as Array<{ labId: string; status: string }>).map(p => [p.labId, p])
    )
    const trackOrder = ["linux", "terraform", "jenkins", "docker", "git"]
    const seen = new Set((labs as Array<{ track: string; id: string }>).map(l => l.track))
    const tracks = [...trackOrder.filter(t => seen.has(t)), ...[...seen].filter(t => !trackOrder.includes(t))]
    return tracks.map(track => {
      const trackLabs = (labs as Array<{ track: string; id: string }>).filter(l => l.track === track)
      const passed = trackLabs.filter(l => byLabId[l.id]?.status === "passed").length
      const total = trackLabs.length
      return { track, passed, total, complete: passed === total && total > 0 }
    })
  }, [labs, progress])

  // Detect whether this user has a credential (email/password) account or is
  // OAuth-only. Better Auth exposes GET /api/auth/list-accounts for exactly this.
  const { data: accounts } = useQuery<{ providerId: string }[]>({
    queryKey: ["auth-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/auth/list-accounts")
      if (!res.ok) throw new Error("Could not fetch accounts")
      return res.json()
    },
    enabled: !!user,
    staleTime: Infinity,
  })

  const hasCredentialAccount = accounts?.some(a => a.providerId === "credential") ?? null
  // null = still loading; true/false = determined

  useEffect(() => {
    if (!isPending && !user) setLocation(`${basePath}/sign-in`)
  }, [isPending, user])

  const initial = (user?.name || user?.email || "?").charAt(0).toUpperCase()

  async function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault()
    setNameMsg(null)
    setNameLoading(true)
    try {
      const res = await authClient.updateUser({ name: name.trim() })
      if (res.error) setNameMsg({ ok: false, text: res.error.message ?? "Could not update name." })
      else            setNameMsg({ ok: true,  text: "Name updated." })
    } catch {
      setNameMsg({ ok: false, text: "Something went wrong." })
    } finally {
      setNameLoading(false)
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPwdMsg(null)
    if (newPwd.length < 8) {
      setPwdMsg({ ok: false, text: "New password must be at least 8 characters." })
      return
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg({ ok: false, text: "Passwords do not match." })
      return
    }
    setPwdLoading(true)
    try {
      const res = await authClient.changePassword({ currentPassword: currentPwd, newPassword: newPwd, revokeOtherSessions: true })
      if (res.error) setPwdMsg({ ok: false, text: res.error.message ?? "Could not change password." })
      else {
        setPwdMsg({ ok: true, text: "Password changed. You'll be signed out of other sessions." })
        setCurrentPwd("")
        setNewPwd("")
        setConfirmPwd("")
      }
    } catch {
      setPwdMsg({ ok: false, text: "Something went wrong." })
    } finally {
      setPwdLoading(false)
    }
  }

  async function handleDeleteAccount() {
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      const res = await fetch(`${basePath}/api/account`, { method: "DELETE", credentials: "include" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setDeleteError((body as { error?: string }).error ?? "Deletion failed. Please try again.")
        return
      }
      // Sign out then redirect home
      await fetch(`${basePath}/api/auth/sign-out`, { method: "POST", credentials: "include", keepalive: true })
      window.location.href = basePath || "/"
    } catch {
      setDeleteError("Network error. Please try again.")
    } finally {
      setDeleteLoading(false)
    }
  }

  if (isPending || !user) return null

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-primary/20 bg-primary/[0.07] backdrop-blur-md">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`${basePath}/dashboard`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Link>
            <div className="w-px h-4 bg-border/60" />
            <div className="flex items-center gap-2">
              <img src={`${basePath}/logo.svg`} className="w-4 h-4 rounded-sm" />
              <span className="font-bold text-sm tracking-tight">DevLabMaster</span>
            </div>
          </div>
          <AccountDropdown />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6 relative z-10">
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>

        {/* Account info card */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-2xl font-black text-primary">
              {initial}
            </div>
            <div>
              <p className="font-semibold text-lg leading-tight">{user.name || "—"}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 rounded-lg px-3 py-2 border border-border/50">
            <Mail className="w-3.5 h-3.5" />
            <span>Student ID: <span className="font-mono">{user.id.slice(0, 8)}…</span></span>
          </div>
        </div>

        {/* Update name */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold">Display name</h2>
          </div>
          <form onSubmit={handleNameSubmit} className="space-y-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                placeholder={user.name || "Your name"}
                value={name}
                onChange={e => setName(e.target.value)}
                required
                minLength={1}
              />
            </div>
            {nameMsg && (
              <p className={`text-sm rounded-lg px-3 py-2 border flex items-center gap-2 ${
                nameMsg.ok
                  ? "text-green-400 bg-green-500/10 border-green-500/20"
                  : "text-destructive bg-destructive/10 border-destructive/20"
              }`}>
                {nameMsg.ok && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                {nameMsg.text}
              </p>
            )}
            <Button type="submit" disabled={nameLoading || !name.trim()}>
              {nameLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Update name
            </Button>
          </form>
        </div>

        {/* Change password */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold">Change password</h2>
          </div>

          {/* Still loading account type — avoid flicker by showing a skeleton */}
          {hasCredentialAccount === null && (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 w-32 rounded bg-muted/40" />
              <div className="h-9 rounded-md bg-muted/30" />
              <div className="h-4 w-32 rounded bg-muted/40" />
              <div className="h-9 rounded-md bg-muted/30" />
              <div className="h-9 w-36 rounded-md bg-muted/30" />
            </div>
          )}

          {/* OAuth-only account — no password exists to change */}
          {hasCredentialAccount === false && (
            <div className="flex items-start gap-3 rounded-lg bg-muted/30 border border-border/60 px-4 py-3 text-sm text-muted-foreground">
              <Chrome className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Your account uses Google sign-in — no password is set. You can sign in with Google on any device without a password.</span>
            </div>
          )}

          {/* Credential account — show the form */}
          {hasCredentialAccount === true && (
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="current-pwd">Current password</Label>
                <Input
                  id="current-pwd"
                  type="password"
                  placeholder="••••••••"
                  value={currentPwd}
                  onChange={e => setCurrentPwd(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-pwd">New password</Label>
                <Input
                  id="new-pwd"
                  type="password"
                  placeholder="Min 8 characters"
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm-pwd">Confirm new password</Label>
                <Input
                  id="confirm-pwd"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              {pwdMsg && (
                <p className={`text-sm rounded-lg px-3 py-2 border flex items-center gap-2 ${
                  pwdMsg.ok
                    ? "text-green-400 bg-green-500/10 border-green-500/20"
                    : "text-destructive bg-destructive/10 border-destructive/20"
                }`}>
                  {pwdMsg.ok && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                  {pwdMsg.text}
                </p>
              )}
              <Button type="submit" disabled={pwdLoading || hasCredentialAccount === null}>
                {pwdLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Change password
              </Button>
            </form>
          )}
        </div>

        {/* Track progress & certificates */}
        {trackStats.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Track Progress</h2>
              <Link href={`${basePath}/progress`} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                View full progress →
              </Link>
            </div>
            <div className="space-y-3">
              {trackStats.map(({ track, passed, total, complete }) => {
                const tm = TRACK_META[track] ?? { ...DEFAULT_TRACK_META, label: track }
                const Icon = tm.icon
                const pct = total > 0 ? Math.round((passed / total) * 100) : 0
                return (
                  <div key={track} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: tm.accentHex }} />
                        <span className="font-medium">{tm.label}</span>
                        {complete && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span className="font-mono">{passed}/{total}</span>
                        {complete && (
                          <Link
                            href={`${basePath}/certificate/${track}`}
                            className="flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors font-semibold"
                          >
                            <Award className="w-3 h-3" />
                            Certificate
                          </Link>
                        )}
                      </div>
                    </div>
                    <Progress
                      value={pct}
                      className="h-1.5 bg-background border border-border/50"
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Danger zone */}
        <div className="rounded-2xl border border-border/50 bg-card/50 p-6 space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Account</p>

          {/* Sign out */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Sign out</p>
              <p className="text-xs text-muted-foreground mt-0.5">End your current session</p>
            </div>
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                void fetch(`${basePath}/api/auth/sign-out`, { method: "POST", credentials: "include", keepalive: true })
                window.location.href = basePath || "/"
              }}
            >
              Sign out
            </Button>
          </div>

          <div className="border-t border-border/40" />

          {/* Delete account */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-destructive">Delete account</p>
              <p className="text-xs text-muted-foreground mt-0.5">Permanently erase your account and all progress</p>
            </div>
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setDeleteStep(1)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Delete
            </Button>
          </div>
        </div>

        {/* ── Delete confirmation modal ── */}
        {deleteStep > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-destructive/40 bg-card p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 border border-destructive/30 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="font-bold text-sm">Delete your account?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">This cannot be undone.</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">
                All your data will be permanently deleted — your progress, certificates, and account details. You will not be able to recover them.
              </p>

              {deleteStep === 1 && (
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => setDeleteStep(0)}>
                    Cancel
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                    onClick={() => { setDeleteInput(""); setDeleteError(null); setDeleteStep(2) }}
                  >
                    Yes, I understand
                  </Button>
                </div>
              )}

              {deleteStep === 2 && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Type <span className="font-mono font-bold text-foreground">DELETE</span> to confirm
                    </Label>
                    <Input
                      className="mt-1.5 font-mono"
                      placeholder="DELETE"
                      value={deleteInput}
                      onChange={e => { setDeleteInput(e.target.value); setDeleteError(null) }}
                      autoFocus
                    />
                  </div>
                  {deleteError && (
                    <p className="text-xs text-destructive">{deleteError}</p>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setDeleteStep(0)} disabled={deleteLoading}>
                      Cancel
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-50"
                      disabled={deleteInput !== "DELETE" || deleteLoading}
                      onClick={handleDeleteAccount}
                    >
                      {deleteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Delete my account"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
