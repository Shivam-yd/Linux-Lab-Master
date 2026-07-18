import { useState } from "react"
import { Zap, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react"
import { Link } from "wouter"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const redirectTo = `${window.location.origin}${basePath}/reset-password`
      const res = await authClient.forgetPassword({ email, redirectTo })
      if (res.error) setError(res.error.message ?? "Something went wrong.")
      else setSent(true)
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
          {sent ? (
            <div className="text-center space-y-4 py-2">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto" />
              <div>
                <h1 className="text-xl font-bold mb-1">Check your email</h1>
                <p className="text-sm text-muted-foreground">
                  If <span className="text-foreground font-medium">{email}</span> has an account,
                  a reset link has been sent. It expires in 1 hour.
                </p>
              </div>
              <Link
                href={`${basePath}/sign-in`}
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-bold mb-1">Forgot your password?</h1>
                <p className="text-sm text-muted-foreground">
                  Enter your email and we'll send you a reset link.
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
                  Send reset link
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
