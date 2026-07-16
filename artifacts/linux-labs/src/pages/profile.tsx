import { useState, useEffect } from "react"
import { Link, useLocation } from "wouter"
import { useSession, signOut, authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Zap, ArrowLeft, Loader2, CheckCircle2, User, Mail, Lock } from "lucide-react"

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
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdMsg, setPwdMsg]         = useState<{ ok: boolean; text: string } | null>(null)

  const user = session?.user

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
    setPwdLoading(true)
    try {
      const res = await authClient.changePassword({ currentPassword: currentPwd, newPassword: newPwd, revokeOtherSessions: true })
      if (res.error) setPwdMsg({ ok: false, text: res.error.message ?? "Could not change password." })
      else {
        setPwdMsg({ ok: true, text: "Password changed. You'll be signed out of other sessions." })
        setCurrentPwd("")
        setNewPwd("")
      }
    } catch {
      setPwdMsg({ ok: false, text: "Something went wrong." })
    } finally {
      setPwdLoading(false)
    }
  }

  if (isPending || !user) return null

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`${basePath}/dashboard`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Link>
            <div className="w-px h-4 bg-border/60" />
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="font-bold text-sm tracking-tight">LinuxLabMaster</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-6 relative z-10">
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
            <Button type="submit" disabled={pwdLoading}>
              {pwdLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Change password
            </Button>
          </form>
        </div>

        {/* Danger zone */}
        <div className="rounded-2xl border border-border/50 bg-card/50 p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Sign out</p>
            <p className="text-xs text-muted-foreground mt-0.5">End your current session</p>
          </div>
          <Button
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => signOut({ fetchOptions: { onSuccess: () => { window.location.href = basePath || "/" } } })}
          >
            Sign out
          </Button>
        </div>
      </main>
    </div>
  )
}
