import { Link } from "wouter"
import {
  ArrowLeft, Zap, Github, Linkedin, MapPin, Terminal,
  Layers, Server, Container, GitBranch, CheckCircle2,
  BookOpen, ExternalLink, Heart, Award, BarChart3,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AccountDropdown } from "@/components/account-dropdown"
import { ThemeToggle } from "@/components/theme-toggle"

const TRACKS = [
  { label: "Linux",     icon: Terminal,  color: "#22d3ee", desc: "Filesystem, processes, networking, permissions, scripting" },
  { label: "Terraform", icon: Layers,    color: "#c084fc", desc: "Infrastructure as Code — variables, modules, state, workspaces" },
  { label: "Jenkins",   icon: Server,    color: "#f97316", desc: "CI/CD fundamentals — pipelines, plugins, jobs, access control" },
  { label: "Docker",    icon: Container, color: "#38bdf8", desc: "Images, containers, Dockerfiles, volumes — via realistic simulator" },
  { label: "Git",       icon: GitBranch, color: "#f87171", desc: "Commits, branches, merges, remotes, stash & reset" },
]

const FEATURES = [
  { icon: Terminal,      title: "Real Terminals",          desc: "Every lab opens a live shell inside an isolated Docker container — no multiple-choice, no VMs to configure." },
  { icon: CheckCircle2,  title: "Automatic Verification",  desc: "Click Verify and the platform runs check scripts inside your container. Each task is binary: PASS or FAIL, with an exact hint." },
  { icon: BookOpen,      title: "Progressive Curriculum",  desc: "Labs are ordered Foundation → Intermediate → Advanced. Each one builds on the last so concepts stack naturally." },
  { icon: BarChart3,     title: "Progress Tracking",       desc: "Every lab attempt is recorded. Your dashboard shows passed labs, scores, and last-active time across all tracks." },
  { icon: Award,         title: "Completion Certificates", desc: "Finish every lab in a track and a certificate is generated automatically — shareable proof of your achievement." },
]

export default function About() {
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-20 h-14 border-b border-primary/20 bg-primary/[0.07] backdrop-blur-md flex items-center justify-between px-6 gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            BACK
          </Link>
          <div className="w-px h-5 bg-border/80" />
          <div className="flex items-center gap-2">
            <img src="/logo.svg" className="w-4 h-4 rounded-sm" />
            <span className="font-bold text-[15px] tracking-tight">DevLabMaster</span>
            <span className="text-muted-foreground/50 font-mono text-xs">/ about</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <AccountDropdown />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-14 space-y-20">

        {/* ── Hero ── */}
        <section className="text-center space-y-6 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent rounded-3xl pointer-events-none -mx-6" />
          <div className="relative z-10 space-y-5 py-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono font-semibold tracking-widest uppercase">
              <Zap className="w-3.5 h-3.5 fill-primary/30" />
              DevLabMaster
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
              Learn DevOps by{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-cyan-300">
                doing it
              </span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
              A self-hosted platform that drops you into real terminal environments to
              practise Linux, Terraform, Jenkins, Docker, and Git — no cloud account,
              no local setup, no multiple-choice questions.
            </p>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border/50" />
            <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground px-2">
              How It Works
            </h2>
            <div className="h-px flex-1 bg-border/50" />
          </div>

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
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border/50" />
            <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground px-2">
              Lab Tracks
            </h2>
            <div className="h-px flex-1 bg-border/50" />
          </div>

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
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border/50" />
            <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground px-2">
              Author
            </h2>
            <div className="h-px flex-1 bg-border/50" />
          </div>

          <div className="rounded-2xl bg-card border border-border/60 overflow-hidden">
            {/* Accent band */}
            <div className="h-1.5 w-full bg-gradient-to-r from-primary via-cyan-400 to-blue-500" />

            <div className="p-8 flex flex-col sm:flex-row gap-8 items-start">

              <div className="shrink-0">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/30 to-cyan-500/20 border border-primary/20 flex items-center justify-center shadow-[0_0_30px_rgba(var(--primary),0.15)]">
                  <span className="text-4xl font-black text-primary select-none">S</span>
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="text-2xl font-black tracking-tight">Shivam Yadav</h3>
                  <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>India</span>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
                  DevOps engineer focused on building practical tools for
                  infrastructure and cloud learning. I created DevLabMaster to give engineers
                  a hands-on environment for mastering the full DevOps toolchain—Linux, Terraform,
                  Docker, Kubernetes, and more—without configuring VMs or cloud accounts.
                  Just open a lab and start solving real-world tasks.
                </p>

                {/* Links */}
                <div className="flex flex-wrap gap-3 pt-1">
                  <a
                    href="https://github.com/Shivam-yd/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold",
                      "bg-foreground/5 border border-border hover:border-foreground/30 hover:bg-foreground/10",
                      "transition-all duration-200"
                    )}
                  >
                    <Github className="w-4 h-4" />
                    GitHub
                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                  </a>
                  <a
                    href="https://www.linkedin.com/in/shivamyd"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold",
                      "bg-[#0077B5]/10 border border-[#0077B5]/30 hover:bg-[#0077B5]/20 hover:border-[#0077B5]/50",
                      "text-[#38bdf8] transition-all duration-200"
                    )}
                  >
                    <Linkedin className="w-4 h-4" />
                    LinkedIn
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="text-center text-xs font-mono text-muted-foreground/50 pb-4">
          Built with{" "}
          <Heart className="w-3 h-3 inline text-primary/60 fill-primary/20 mx-0.5" />
          {" "}by Shivam Yadav · DevLabMaster
        </footer>

      </main>
    </div>
  )
}
