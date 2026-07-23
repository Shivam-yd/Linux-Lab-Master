import { useState, useEffect } from "react"
import { Loader2, Lock, CheckCircle2, Clock } from "lucide-react"
import { Link, useLocation, Redirect } from "wouter"
import { signIn, signUp, useSession } from "@/lib/auth-client"
import { useConfig } from "@/lib/use-config"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

type RegStatus = { mode: "open" | "invite_only" | "invite_or_request" }
type CheckStatus = "approved" | "pending" | "none"
type CheckPhase = "email" | "checking" | "approved" | "pending" | "request" | "done"

export default function SignUpPage() {
  useEffect(() => { document.title = "Sign Up — DevLabMaster" }, [])
  const [, setLocation] = useLocation()
  const { data: session, isPending } = useSession()
  const { data: config } = useConfig()

  // Open-mode signup state
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [signupError, setSignupError] = useState<string | null>(null)
  const [signupLoading, setSignupLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setLocation("/choose-plan"), 2000)
    return () => clearTimeout(t)
  }, [done])

  // Restricted-mode state machine
  const [checkEmail, setCheckEmail] = useState("")
  const [checkPhase, setCheckPhase] = useState<CheckPhase>("email")
  const [reqName, setReqName] = useState("")
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const { data: regStatus } = useQuery<RegStatus>({
    queryKey: ["registration-status"],
    queryFn: async () => {
      const res = await fetch("/api/registration-status")
      return res.json()
    },
    staleTime: 30_000,
  })

  if (done) return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center gap-6 text-center">
        <div className="w-16 h-16 rounded-full bg-green-400/10 border border-green-400/20 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-green-400" />
        </div>
        <div>
          <p className="text-lg font-bold">Account created!</p>
          <p className="text-sm text-muted-foreground mt-1">Welcome to DevLabMaster. Setting up your plan…</p>
        </div>
      </div>
    </div>
  )

  if (!isPending && session?.user) return <Redirect to="/dashboard" />

  const mode = regStatus?.mode ?? "open"

  // ── Open-mode signup ──────────────────────────────────────────────────────

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setSignupError(null)
    setSignupLoading(true)
    try {
      const res = await signUp.email({ name, email, password })
      if (res.error) setSignupError(res.error.message ?? "Could not create account.")
      else setDone(true)
    } catch {
      setSignupError("Something went wrong. Please try again.")
    } finally {
      setSignupLoading(false)
    }
  }

  async function handleGoogle() {
    await signIn.social({ provider: "google", callbackURL: `${window.location.origin}${basePath}/dashboard` })
  }

  // ── Restricted-mode: email check ──────────────────────────────────────────

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault()
    setActionError(null)
    setCheckPhase("checking")
    try {
      const res = await fetch("/api/registration-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: checkEmail }),
      })
      if (!res.ok) throw new Error("Server error")
      const body: { status: CheckStatus } = await res.json()
      if (body.status === "approved") {
        setCheckPhase("approved")
      } else if (body.status === "pending") {
        setCheckPhase("pending")
      } else {
        // "none" — either request form or contact message depending on mode
        setCheckPhase(mode === "invite_or_request" ? "request" : "email")
        if (mode === "invite_only") setActionError("Your email isn't on the approved list. Contact your instructor.")
      }
    } catch {
      setCheckPhase("email")
      setActionError("Something went wrong. Please try again.")
    }
  }

  // Signup after approval (email pre-filled, locked)
  async function handleApprovedSignup(e: React.FormEvent) {
    e.preventDefault()
    setActionError(null)
    setActionLoading(true)
    try {
      const res = await signUp.email({ name: reqName, email: checkEmail, password })
      if (res.error) setActionError(res.error.message ?? "Could not create account.")
      else setDone(true)
    } catch {
      setActionError("Something went wrong. Please try again.")
    } finally {
      setActionLoading(false)
    }
  }

  // Submit access request
  async function handleRequest(e: React.FormEvent) {
    e.preventDefault()
    setActionError(null)
    setActionLoading(true)
    try {
      const res = await fetch("/api/registration-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: reqName, email: checkEmail }),
      })
      const body = await res.json()
      if (!res.ok) setActionError(body.error ?? "Could not submit request.")
      else setCheckPhase("done")
    } catch {
      setActionError("Something went wrong. Please try again.")
    } finally {
      setActionLoading(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-sm">

        <Link href="/" className="flex items-center gap-3 group">
          <img src={`${basePath}/logo.svg`} className="w-10 h-10 rounded-xl" alt="DevLabMaster" />
          <span className="text-lg font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
            DevLabMaster
          </span>
        </Link>

        <div className="w-full bg-card border border-border rounded-2xl p-8 shadow-[0_0_40px_rgba(45,212,191,0.08)]">

          {/* ── Open: standard signup ──────────────────────────────────── */}
          {mode === "open" && (
            <>
              <h1 className="text-xl font-bold mb-1">Create your account</h1>
              <p className="text-sm text-muted-foreground mb-6">Track your progress across every lab and track</p>

              {config?.googleEnabled && (
                <>
                  <Button variant="outline" className="w-full mb-4" onClick={handleGoogle} type="button">
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                  </Button>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                    <div className="relative flex justify-center text-xs text-muted-foreground"><span className="bg-card px-2">or</span></div>
                  </div>
                </>
              )}

              <form onSubmit={handleSignup} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} required autoComplete="name" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
                </div>
                {signupError && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{signupError}</p>}
                <Button type="submit" disabled={signupLoading} className="w-full mt-1">
                  {signupLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Create account
                </Button>
              </form>

              <p className="text-sm text-center text-muted-foreground mt-6">
                Already have an account?{" "}
                <Link href={`${basePath}/sign-in`} className="text-primary font-semibold hover:underline">Sign in</Link>
              </p>
            </>
          )}

          {/* ── Restricted: email-first check ─────────────────────────── */}
          {mode !== "open" && (
            <>
              <div className="flex items-center gap-2 mb-5">
                <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                <p className="text-xs text-amber-400 font-medium">
                  {mode === "invite_only" ? "Registration is invite-only" : "Registration is restricted"}
                </p>
              </div>

              {/* Step 1: enter email to check */}
              {(checkPhase === "email" || checkPhase === "checking") && (
                <>
                  <h1 className="text-xl font-bold mb-1">Check your status</h1>
                  <p className="text-sm text-muted-foreground mb-6">
                    Enter your email to see if you've been approved
                    {mode === "invite_or_request" ? " or to request access" : ""}.
                  </p>
                  <form onSubmit={handleCheck} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="check-email">Email</Label>
                      <Input
                        id="check-email"
                        type="email"
                        placeholder="you@example.com"
                        value={checkEmail}
                        onChange={e => { setCheckEmail(e.target.value); setActionError(null) }}
                        required
                        autoComplete="email"
                      />
                    </div>
                    {actionError && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{actionError}</p>}
                    <Button type="submit" disabled={checkPhase === "checking"} className="w-full mt-1">
                      {checkPhase === "checking" && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Check status
                    </Button>
                  </form>
                </>
              )}

              {/* Step 2a: approved — complete signup */}
              {checkPhase === "approved" && (
                <>
                  <div className="flex items-center gap-2 mb-5 text-green-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <p className="text-xs font-medium">Your email has been approved — complete your account below.</p>
                  </div>
                  <h1 className="text-xl font-bold mb-6">Create your account</h1>
                  <form onSubmit={handleApprovedSignup} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="ap-name">Name</Label>
                      <Input id="ap-name" type="text" placeholder="Your name" value={reqName} onChange={e => setReqName(e.target.value)} required autoComplete="name" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="ap-email">Email</Label>
                      <Input id="ap-email" type="email" value={checkEmail} readOnly className="opacity-60 cursor-not-allowed" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="ap-password">Password</Label>
                      <Input id="ap-password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
                    </div>
                    {actionError && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{actionError}</p>}
                    <Button type="submit" disabled={actionLoading} className="w-full mt-1">
                      {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Create account
                    </Button>
                  </form>
                </>
              )}

              {/* Step 2b: pending — nothing to do yet */}
              {checkPhase === "pending" && (
                <div className="text-center space-y-4 py-2">
                  <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mx-auto">
                    <Clock className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="font-semibold">Request under review</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your request for <span className="text-foreground font-medium">{checkEmail}</span> is pending. You'll be able to sign up once your instructor approves it.
                    </p>
                  </div>
                  <button onClick={() => { setCheckPhase("email"); setActionError(null) }} className="text-xs text-muted-foreground hover:text-foreground underline">
                    Try a different email
                  </button>
                </div>
              )}

              {/* Step 2c: not found + invite_or_request — submit request */}
              {checkPhase === "request" && (
                <>
                  <h1 className="text-xl font-bold mb-1">Request access</h1>
                  <p className="text-sm text-muted-foreground mb-6">
                    No account found for <span className="text-foreground font-medium">{checkEmail}</span>. Submit a request and your instructor will review it.
                  </p>
                  <form onSubmit={handleRequest} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="req-name">Name</Label>
                      <Input id="req-name" type="text" placeholder="Your name" value={reqName} onChange={e => setReqName(e.target.value)} required autoComplete="name" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="req-email">Email</Label>
                      <Input id="req-email" type="email" value={checkEmail} readOnly className="opacity-60 cursor-not-allowed" />
                    </div>
                    {actionError && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{actionError}</p>}
                    <Button type="submit" disabled={actionLoading} className="w-full mt-1">
                      {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Submit request
                    </Button>
                  </form>
                  <button onClick={() => { setCheckPhase("email"); setActionError(null) }} className="w-full text-xs text-muted-foreground hover:text-foreground underline mt-4">
                    Use a different email
                  </button>
                </>
              )}

              {/* Step 2d: request submitted */}
              {checkPhase === "done" && (
                <div className="text-center space-y-4 py-2">
                  <div className="w-12 h-12 rounded-2xl bg-green-400/10 border border-green-400/20 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="font-semibold">Request submitted!</p>
                    <p className="text-sm text-muted-foreground mt-1">Your instructor will review your request. Come back here to check if you've been approved.</p>
                  </div>
                </div>
              )}

              <p className="text-sm text-center text-muted-foreground mt-6">
                Already have an account?{" "}
                <Link href={`${basePath}/sign-in`} className="text-primary font-semibold hover:underline">Sign in</Link>
              </p>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
