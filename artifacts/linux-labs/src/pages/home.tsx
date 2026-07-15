import { Link } from "wouter"
import {
  Zap, Terminal, Layers, Server, Container, GitBranch,
  CheckCircle2, ArrowRight, Github,
} from "lucide-react"

const TRACKS = [
  { label: "Linux", icon: Terminal, color: "#22d3ee" },
  { label: "Terraform", icon: Layers, color: "#c084fc" },
  { label: "Jenkins", icon: Server, color: "#f97316" },
  { label: "Docker", icon: Container, color: "#38bdf8" },
  { label: "Git", icon: GitBranch, color: "#f87171" },
]

const FEATURES = [
  { title: "Real Terminals", desc: "Every lab opens a live shell inside an isolated Docker container — no multiple choice, no VMs to configure." },
  { title: "Automatic Verification", desc: "Click Verify and the platform runs the check scripts inside your container. Each task is PASS or FAIL, with an exact hint." },
  { title: "Your Own Progress", desc: "Sign in and every lab you pass, every streak, and every badge is saved to your account — pick up where you left off, anywhere." },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />

      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-card/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_15px_rgba(45,212,191,0.15)]">
              <Zap className="w-4.5 h-4.5 text-primary fill-primary/20" />
            </div>
            <span className="font-bold text-[15px] tracking-tight">DevLabs</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/about" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              About
            </Link>
            <Link
              href="/sign-in"
              className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="text-sm font-bold px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(45,212,191,0.25)]"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/60 text-xs font-mono font-semibold text-muted-foreground mb-8">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          107 labs across 5 tracks
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.1] max-w-3xl mx-auto">
          Learn DevOps by{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
            doing it for real
          </span>
        </h1>
        <p className="mt-6 text-muted-foreground text-lg max-w-xl mx-auto leading-relaxed">
          Hands-on Linux, Terraform, Jenkins, Docker, and Git labs — each one a real terminal,
          automatically verified. Create a free account to track your progress.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/sign-up"
            className="group px-8 py-3.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:opacity-90 transition-all shadow-[0_0_25px_rgba(45,212,191,0.3)] flex items-center gap-2"
          >
            Create Free Account
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            href="/sign-in"
            className="px-8 py-3.5 rounded-xl text-sm font-bold border border-border bg-card hover:bg-muted/40 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* ── Tracks ── */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {TRACKS.map(({ label, icon: Icon, color }) => (
            <div
              key={label}
              className="rounded-xl border border-border bg-card/60 p-5 flex flex-col items-center gap-3 text-center hover:border-primary/30 transition-colors"
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: `${color}15`, border: `1px solid ${color}30` }}
              >
                <Icon className="w-5 h-5" style={{ color }} />
              </div>
              <span className="text-sm font-semibold">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid sm:grid-cols-3 gap-6">
          {FEATURES.map(({ title, desc }) => (
            <div key={title} className="rounded-2xl border border-border bg-card/60 p-6">
              <CheckCircle2 className="w-5 h-5 text-primary mb-4" />
              <h3 className="font-bold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/60 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-xs text-muted-foreground">
          <span>DevLabs — open-source practice range</span>
          <a href="https://github.com" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
            <Github className="w-3.5 h-3.5" /> Source
          </a>
        </div>
      </footer>
    </div>
  )
}
