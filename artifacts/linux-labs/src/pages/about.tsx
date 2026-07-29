import { useQuery } from "@tanstack/react-query"
import { useMeta } from "@/hooks/use-meta"
import { Link } from "wouter"
import {
  Zap, Linkedin, MapPin, Terminal,
  Layers, Server, Container, GitBranch, CheckCircle2,
  BookOpen, ExternalLink, Heart, Award, BarChart3, RefreshCw, Box,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"
import { BackgroundOrbs } from "@/components/background-orbs"
import { useSession } from "@/lib/auth-client"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

const TRACKS = [
  { label: "Linux",      icon: Terminal,  color: "#22d3ee", desc: "Filesystem, processes, networking, permissions, scripting" },
  { label: "Terraform",  icon: Layers,    color: "#c084fc", desc: "Infrastructure as Code — variables, modules, state, workspaces" },
  { label: "Jenkins",    icon: Server,    color: "#f97316", desc: "CI/CD fundamentals — pipelines, plugins, jobs, access control" },
  { label: "Docker",     icon: Container, color: "#38bdf8", desc: "Images, containers, Dockerfiles, volumes — via realistic simulator" },
  { label: "Git",        icon: GitBranch, color: "#f87171", desc: "Commits, branches, merges, remotes, stash & reset" },
  { label: "Kubernetes", icon: Box,       color: "#60a5fa", desc: "Pods, services, deployments — orchestrate containers with kubectl" },
]

const FEATURES = [
  { icon: Terminal,      title: "Real Terminals",          desc: "Every lab opens a live shell inside an isolated Docker container — no multiple-choice, no VMs to configure." },
  { icon: CheckCircle2,  title: "Automatic Verification",  desc: "Click Verify and the platform runs check scripts inside your container. Each task is binary: PASS or FAIL, with an exact hint." },
  { icon: BookOpen,      title: "Progressive Curriculum",  desc: "Labs are ordered Foundation → Intermediate → Advanced. Each one builds on the last so concepts stack naturally." },
  { icon: BarChart3,     title: "Progress Tracking",       desc: "Every lab attempt is recorded. Your dashboard shows passed labs, scores, and last-active time across all tracks." },
  { icon: Award,         title: "Completion Certificates", desc: "Finish every lab in a track and a certificate is generated automatically — shareable proof of your achievement." },
  { icon: RefreshCw,     title: "Instant Sandbox Reset",   desc: "Blown up your container? Hit Reset and a fresh environment is spun up in seconds — no penalty, just keep going." },
]

const STATIC_STATS = [
  { value: "0",    label: "Cloud accounts needed" },
  { value: "100%", label: "Terminal-based" },
]

export default function About() {
  useMeta("About — DevLabMaster", "The team and mission behind DevLabMaster, the hands-on DevOps training platform.")
  const { data: session, isPending } = useSession()
  const { data: stats } = useQuery<{ labs: number; tracks: number }>({
    queryKey: ["stats"],
    queryFn: () => fetch(`${basePath}/api/stats`).then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div className="min-h-screen bg-background text-foreground">
      <BackgroundOrbs />

      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-20 border-b border-primary/20 bg-primary/8 dark:bg-primary/[0.07] backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src={`${basePath}/logo.svg`} className="w-9 h-9 rounded-xl" alt="DevLabMaster" />
            <span className="font-bold text-[15px] tracking-tight">DevLabMaster</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/pricing" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Pricing</Link>
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

      {/* ── Hero — full-width ── */}
      <div className="relative overflow-hidden border-b border-border/40">
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] via-background to-background" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/[0.06] rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-6 pt-16 pb-14 text-center">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-card/60 border border-border text-foreground text-[13px] font-bold tracking-tight mb-6">
            <img src={`${basePath}/logo.svg`} className="w-5 h-5 rounded-md" alt="DevLabMaster" />
            DevLabMaster
          </div>

          <h1 className="text-4xl md:text-[3.25rem] font-black tracking-tight leading-[1.12] mb-5">
            Learn DevOps by{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-cyan-300">
              doing it
            </span>
          </h1>

          <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
            A self-hosted platform that drops you into real terminal environments to
            practise Linux, Terraform, Jenkins, Docker, Git, and Kubernetes — no cloud
            account, no local setup, no multiple-choice questions.
          </p>

          {/* Stats row */}
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-px bg-border/40 rounded-2xl overflow-hidden border border-border/40">
            <div className="bg-card/60 px-6 py-5 text-center">
              <p className="text-2xl font-black text-foreground tabular-nums">{stats ? `${stats.labs}+` : "—"}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-tight">Hands-on labs</p>
            </div>
            <div className="bg-card/60 px-6 py-5 text-center">
              <p className="text-2xl font-black text-foreground tabular-nums">{stats ? stats.tracks : "—"}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-tight">DevOps tracks</p>
            </div>
            {STATIC_STATS.map(({ value, label }) => (
              <div key={label} className="bg-card/60 px-6 py-5 text-center">
                <p className="text-2xl font-black text-foreground tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-tight">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-14 space-y-20">

        {/* ── How it works ── */}
        <section className="space-y-8">
          <SectionHeading>How It Works</SectionHeading>
          <div className="grid sm:grid-cols-2 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="p-6 rounded-2xl bg-card border border-border/60 hover:border-primary/30 transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-bold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Tracks ── */}
        <section className="space-y-8">
          <SectionHeading>Lab Tracks</SectionHeading>
          <div className="space-y-3">
            {TRACKS.map(({ label, icon: Icon, color, desc }) => (
              <div
                key={label}
                className="flex items-center gap-5 p-4 rounded-xl bg-card border border-border/60 hover:border-border transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${color}18`, border: `1px solid ${color}30` }}
                >
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Author ── */}
        <section className="space-y-8">
          <SectionHeading>Author</SectionHeading>

          <div className="rounded-2xl bg-card border border-border/60 p-8">
            <div className="flex flex-col sm:flex-row gap-6 items-start">

              {/* Avatar */}
              <div className="shrink-0 w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <span className="text-xl font-black text-primary select-none">SY</span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-xl font-bold tracking-tight">Shivam Yadav</h3>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary">
                    Builder
                  </span>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3 shrink-0" />
                    India
                  </div>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed">
                  DevOps engineer focused on building practical tools for infrastructure and cloud learning.
                  Created DevLabMaster to give engineers a hands-on environment for mastering the full
                  DevOps toolchain — without configuring VMs or cloud accounts.
                </p>

                <a
                  href="https://www.linkedin.com/in/shivamyd"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-lg bg-[#0A66C2]/10 border border-[#0A66C2]/20 text-[#0A66C2] hover:bg-[#0A66C2]/20 transition-colors"
                >
                  <Linkedin className="w-4 h-4" />
                  LinkedIn
                </a>
              </div>
            </div>
          </div>
        </section>

        <p className="text-center text-xs font-mono text-muted-foreground/50 pb-4">
          Built with{" "}
          <Heart className="w-3 h-3 inline text-primary/60 fill-primary/20 mx-0.5" />
          {" "}by Shivam Yadav · DevLabMaster
        </p>

      </main>

      <div className="h-8 pointer-events-none" style={{ background: "radial-gradient(ellipse at bottom left, rgba(13,148,136,0.07) 0%, transparent 70%)" }} />

      <footer className="relative z-10 border-t border-primary/20 py-4 bg-primary/8 dark:bg-primary/[0.07] backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>DevLabMaster — DevOps practice range</span>
          <div className="flex items-center gap-6">
            <Link href="/about" className="hover:text-foreground transition-colors">About</Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-border/50" />
      <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground px-2">
        {children}
      </h2>
      <div className="h-px flex-1 bg-border/50" />
    </div>
  )
}
