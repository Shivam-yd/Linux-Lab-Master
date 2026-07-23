import { useEffect, useState } from "react"
import { useLocation, Redirect } from "wouter"
import { useSession } from "@/lib/auth-client"
import { usePlan } from "@/lib/use-plan"
import { useQueryClient } from "@tanstack/react-query"
import {
  Terminal, Container, Layers, Server, GitBranch,
  Check, ArrowRight, Loader2, ShieldCheck, Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

const PLANS = {
  "linux-starter": {
    name: "Linux Starter",
    tagline: "Master the Linux command line",
    accentHex: "#22d3ee",
    accentClass: "text-cyan-400",
    borderClass: "border-cyan-400/30",
    bgClass: "bg-cyan-400/5",
    tracks: [{ icon: Terminal, label: "Linux", color: "#22d3ee" }],
    features: [
      "All Linux labs (beginner → advanced)",
      "Real terminal sandboxes",
      "Automatic task verification",
      "Progress tracking",
      "Completion certificate",
    ],
    labCount: "36 labs",
    duration: "~12 hrs",
  },
  "devops-pro": {
    name: "DevOps Pro",
    tagline: "Full DevOps engineering toolkit",
    accentHex: "#c084fc",
    accentClass: "text-purple-400",
    borderClass: "border-purple-400/30",
    bgClass: "bg-purple-400/5",
    tracks: [
      { icon: Terminal,  label: "Linux",     color: "#22d3ee" },
      { icon: Container, label: "Docker",    color: "#38bdf8" },
      { icon: Layers,    label: "Terraform", color: "#c084fc" },
      { icon: Server,    label: "Jenkins",   color: "#f97316" },
      { icon: GitBranch, label: "Git",       color: "#f87171" },
    ],
    features: [
      "Everything in Linux Starter",
      "Docker containers & images",
      "Terraform infrastructure as code",
      "Jenkins CI/CD pipelines",
      "Git version control",
      "All future tracks included",
    ],
    labCount: "78+ labs",
    duration: "~40 hrs",
  },
} as const

type PlanId = keyof typeof PLANS

export default function CheckoutPage() {
  useEffect(() => { document.title = "Checkout — DevLabMaster" }, [])
  const [, setLocation] = useLocation()
  const { data: session, isPending } = useSession()
  const { hasSubscription, isLoading: planLoading } = usePlan()
  const qc = useQueryClient()
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Read plan from URL query string
  const params = new URLSearchParams(window.location.search)
  const planId = params.get("plan") as PlanId | null

  if (!isPending && !session?.user) return <Redirect to="/sign-in" />
  if (!isPending && !planLoading && hasSubscription) return <Redirect to="/dashboard" />
  if (planId && !(planId in PLANS)) return <Redirect to="/choose-plan" />

  const plan = planId ? PLANS[planId] : null
  if (!plan) return <Redirect to="/choose-plan" />

  async function activate() {
    setActivating(true)
    setError(null)
    try {
      const res = await fetch(`${basePath}/api/account/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan: planId }),
      })
      if (!res.ok) throw new Error()
      await qc.invalidateQueries({ queryKey: ["account", "plan"] })
      setLocation("/dashboard")
    } catch {
      setError("Something went wrong. Please try again.")
      setActivating(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-primary/20 bg-primary/[0.07] backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-3">
          <img src={`${basePath}/logo.svg`} className="w-7 h-7 rounded-lg" alt="DevLabMaster" />
          <span className="font-bold text-sm tracking-tight">DevLabMaster</span>
          <span className="text-muted-foreground/40 mx-1">›</span>
          <span className="text-sm text-muted-foreground">Checkout</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-10 grid lg:grid-cols-[1fr_340px] gap-8 items-start">

        {/* ── Left: plan details ── */}
        <div className="space-y-6">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-[11px] font-semibold tracking-widest uppercase mb-4"
              style={{ background: plan.accentHex + "14", borderColor: plan.accentHex + "40", color: plan.accentHex }}>
              <Zap className="w-3 h-3" />
              Currently Free · Early Access
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{plan.name}</h1>
            <p className="text-muted-foreground mt-1">{plan.tagline}</p>
          </div>

          {/* Tracks */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Included tracks</p>
            <div className="flex flex-wrap gap-2">
              {plan.tracks.map(({ icon: Icon, label, color }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold"
                  style={{ background: color + "18", border: `1px solid ${color}35`, color }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Features */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">What's included</p>
            <ul className="space-y-2.5">
              {plan.features.map(f => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: plan.accentHex }} />
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Labs", value: plan.labCount },
              { label: "Content", value: plan.duration },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-bold mt-0.5" style={{ color: plan.accentHex }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: order summary ── */}
        <div className="rounded-2xl border bg-card overflow-hidden sticky top-20"
          style={{ borderColor: plan.accentHex + "40" }}>

          <div className="px-5 py-4 border-b border-border/60">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Your plan</p>

            {/* Plan row */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: plan.accentHex + "18" }}>
                {plan.tracks[0] && (() => { const Icon = plan.tracks[0].icon; return <Icon className="w-4 h-4" style={{ color: plan.accentHex }} /> })()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{plan.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{plan.tracks.map(t => t.label).join(" · ")}</p>
              </div>
              <span className="text-sm font-semibold shrink-0" style={{ color: plan.accentHex }}>Free</span>
            </div>
          </div>

          {/* Included summary */}
          <div className="px-5 py-4 border-b border-border/60 space-y-2">
            {plan.features.slice(0, 4).map(f => (
              <div key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Check className="w-3 h-3 shrink-0" style={{ color: plan.accentHex }} />
                <span className="truncate">{f}</span>
              </div>
            ))}
          </div>

          {/* Pricing */}
          <div className="px-5 py-4 border-b border-border/60 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Plan</span>
              <span>₹0</span>
            </div>
            <div className="flex items-center justify-between font-bold">
              <span>Due today</span>
              <span className="text-lg">₹0</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Paid plans launching soon — early users get a discount.
            </p>
          </div>

          {/* CTA */}
          <div className="px-5 py-4 space-y-3">
            {error && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-center">
                {error}
              </p>
            )}
            <Button
              className={cn("w-full font-bold gap-2 h-11")}
              style={!activating ? { background: plan.accentHex, color: "#000" } : undefined}
              onClick={activate}
              disabled={activating}
            >
              {activating
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Activating…</>
                : <>Activate plan <ArrowRight className="w-4 h-4" /></>}
            </Button>
            <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="w-3.5 h-3.5" />
              No credit card required · Cancel anytime
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
