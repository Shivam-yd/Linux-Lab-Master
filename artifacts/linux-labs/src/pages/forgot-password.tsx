import { useState } from "react"
import { Zap, Loader2, ArrowLeft, CheckCircle2, Clock } from "lucide-react"
import { Link } from "wouter"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

type Stage = "form" | "pending" | "approved"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState<Stage>("form")
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`${basePath}/api/password-reset/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as any).error ?? "Something went wrong.")
        return
      }
      const data = await res.json()
      // Backend returns the current status — jump straight to "approved" if already done.
      setStage(data.status === "approved" ? "approved" : "pending")
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function handleCheckApproval() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(
        `${basePath}/api/password-reset/check?email=${encodeURIComponent(email.toLowerCase().trim())}`,
      )
      const data = await res.json()
      if (data.approved) {
        setStage("approved")
      } else {
        setError("Not approved yet — please wait for an admin to approve your request.")
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
          {stage === "pending" && (
            <div className="text-center space-y-5 py-2">
              <Clock className="w-10 h-10 text-amber-400 mx-auto" />
              <div>
                <h1 className="text-xl font-bold mb-1">Request submitted</h1>
                <p className="text-sm text-muted-foreground">
                  If an account exists for{" "}
                  <span className="text-foreground font-medium">{email}</span>
                  , your request has been queued for admin approval. Check back
                  here once it's been approved.
                </p>
              </div>
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              <Button onClick={handleCheckApproval} disabled={loading} className="w-full">
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Check approval status
              </Button>
              <Link
                href={`${basePath}/sign-in`}
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to sign in
              </Link>
            </div>
          )}

          {stage === "approved" && (
            <div className="text-center space-y-4 py-2">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto" />
              <div>
                <h1 className="text-xl font-bold mb-1">Request approved!</h1>
                <p className="text-sm text-muted-foreground">
                  You can now set a new password for{" "}
                  <span className="text-foreground font-medium">{email}</span>.
                </p>
              </div>
              <Link href={`${basePath}/reset-password?email=${encodeURIComponent(email)}`}>
                <Button className="w-full">Set new password →</Button>
              </Link>
            </div>
          )}

          {stage === "form" && (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-bold mb-1">Forgot your password?</h1>
                <p className="text-sm text-muted-foreground">
                  Enter your email to request a password reset. An admin will
                  approve it before you can set a new password.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <Button type="submit" disabled={loading} className="w-full mt-1">
                  {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Request reset
                </Button>
              </form>

              <p className="text-sm text-center text-muted-foreground mt-6">
                <Link href={`${basePath}/sign-in`} className="flex items-center justify-center gap-1.5 text-primary hover:underline">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
