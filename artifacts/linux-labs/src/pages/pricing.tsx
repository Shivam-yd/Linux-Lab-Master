import { useEffect } from "react"
import { Link } from "wouter"
import { Terminal, Container, Layers, Server, GitBranch, Check, ArrowRight, Zap } from "lucide-react"
import { useSession } from "@/lib/auth-client"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

const PLANS = [
  {
    id: "linux-starter",
    name: "Linux Starter",
    tagline: "Master the Linux command line",
    price: null, // null = free
    accentHex: "#22d3ee",
    accentClass: "text-cyan-400",
    borderClass: "border-cyan-400/30",
    bgClass: "bg-cyan-400/5",
    tracks: [
      { icon: Terminal, label: "Linux", color: "#22d3ee" },
    ],
    features: [
      "All Linux labs (beginner → advanced)",
      "Real terminal sandboxes",
      "Automatic task verification",
      "Progress tracking",
      "Completion certificate",
    ],
  },
  {
    id: "devops-pro",
    name: "DevOps Pro",
    tagline: "Full DevOps engineering toolkit",
    price: null,
    accentHex: "#c084fc",
    accentClass: "text-purple-400",
    borderClass: "border-purple-400/30",
    bgClass: "bg-purple-400/5",
    popular: true,
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
  },
]

export default function PricingPage() {
  useEffect(() => { document.title = "Pricing — DevLabMaster" }, [])
  const { data: session, isPending } = useSession()

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-primary/20 bg-primary/[0.07] backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src={`${basePath}/logo.svg`} className="w-9 h-9 rounded-xl" alt="DevLabMaster" />
            <span className="font-bold text-[15px] tracking-tight">DevLabMaster</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/about" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors hidden sm:block">About</Link>
            <ThemeToggle />
            {!isPending && session?.user
              ? <Link href="/dashboard" className="text-sm font-bold px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity">Dashboard</Link>
              : <>
                  <Link href="/sign-in" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-2">Sign In</Link>
                  <Link href="/sign-up" className="text-sm font-bold px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-[0_2px_16px_rgba(13,148,136,0.25)]">Get Started</Link>
                </>
            }
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-10 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/60 text-xs font-mono font-semibold text-muted-foreground mb-6">
          <Zap className="w-3 h-3 text-primary" />
          Early Access — Currently Free
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
          Simple, honest{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
            pricing
          </span>
        </h1>
        <p className="mt-4 text-muted-foreground text-lg max-w-lg mx-auto">
          Paid plans launching soon. Sign up now and lock in an early-user discount when billing goes live.
        </p>
      </section>

      {/* ── Plan cards ── */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="grid sm:grid-cols-2 gap-6">
          {PLANS.map(plan => (
            <div
              key={plan.id}
              className={cn(
                "relative rounded-2xl border p-8 flex flex-col",
                plan.popular
                  ? `${plan.borderClass} ${plan.bgClass}`
                  : "border-border bg-card/60"
              )}
            >
              {plan.popular && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase"
                  style={{ background: plan.accentHex + "22", border: `1px solid ${plan.accentHex}55`, color: plan.accentHex }}
                >
                  Most Popular
                </div>
              )}

              {/* Name + tagline */}
              <div className="mb-6">
                <h2 className="text-xl font-bold">{plan.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">{plan.tagline}</p>
              </div>

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-black">Free</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Paid plans coming soon · ₹ pricing for India</p>
              </div>

              {/* Tracks */}
              <div className="flex flex-wrap gap-2 mb-6">
                {plan.tracks.map(({ icon: Icon, label, color }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
                    style={{ background: color + "18", border: `1px solid ${color}35`, color }}
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                  </span>
                ))}
              </div>

              {/* Features */}
              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: plan.accentHex }} />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href="/sign-up"
                className={cn(
                  "flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-opacity",
                  plan.popular
                    ? "bg-primary text-primary-foreground hover:opacity-90 shadow-[0_4px_20px_rgba(13,148,136,0.28)]"
                    : "border border-border bg-card hover:bg-muted/40"
                )}
              >
                Start for free
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>

        {/* Fine print */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          No credit card required now. Early users get a discount when paid plans launch.
        </p>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-primary/20 py-4 bg-primary/[0.07] backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>DevLabMaster — DevOps practice range</span>
          <div className="flex items-center gap-4">
            <Link href="/about" className="hover:text-foreground transition-colors">About</Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
