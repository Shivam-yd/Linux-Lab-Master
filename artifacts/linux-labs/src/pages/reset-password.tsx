import { useState } from "react"
import { Zap, Loader2, CheckCircle2 } from "lucide-react"
import { Link, useLocation } from "wouter"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation()
  const token = new URLSearchParams(window.location.search).get("token") ?? ""

  const [newPwd, setNewPwd] = useState("")
  const [confirmPwd, setConfirmPwd] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-3 max-w-sm px-6">
          <p className="text-muted-foreground text-sm">
            This reset link is invalid or has expired.
          </p>
          <Link href={`${basePath}/forgot-password`} className="text-primary text-sm hover:underline">
            Request a new link
          </Link>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (newPwd.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (newPwd !== confirmPwd) {
      setError("Passwords do not match.")
      return
    }
    setLoading(true)
    try {
      const res = await authClient.resetPassword({ newPassword: newPwd, token })
      if (res.error) setError(res.error.message ?? "Could not reset password.")
      else {
        setDone(true)
        setTimeout(() => setLocation(`${basePath}/sign-in`), 2500)
      }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-sm">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_15px_rgba(45,212,191,0.15)]">
            <Zap className="w-5 h-5 text-primary fill-primary/20" />
          </div>
          <span className="text-lg font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
            LinuxLabMaster
          </span>
        </Link>

        <div className="w-full bg-card border border-border rounded-2xl p-8 shadow-[0_0_40px_rgba(45,212,191,0.08)]">
          {done ? (
            <div className="text-center space-y-4 py-2">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto" />
              <div>
                <h1 className="text-xl font-bold mb-1">Password reset!</h1>
                <p className="text-sm text-muted-foreground">Redirecting you to sign in…</p>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-bold mb-1">Set a new password</h1>
                <p className="text-sm text-muted-foreground">
                  Choose a strong password for your account.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                  <Label htmlFor="confirm-pwd">Confirm password</Label>
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

                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <Button type="submit" disabled={loading} className="w-full mt-1">
                  {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Reset password
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
