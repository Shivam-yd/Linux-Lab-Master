import { useMeta } from "@/hooks/use-meta"
import { Link } from "wouter"
import { Redirect } from "wouter"
import { Fragment, useState, useEffect } from "react"
import { Terminal, ArrowRight, ScanLine, TrendingUp, CheckCircle2, Circle, Layers, CheckCheck } from "lucide-react"
import {
  LinuxLogo, TerraformLogo, JenkinsLogo, DockerLogo,
  GitLogo, KubernetesLogo, AnsibleLogo,
} from "@/components/track-logos"
import { motion, type Variants } from "framer-motion"
import { BackgroundOrbs } from "@/components/background-orbs"
import { useQuery } from "@tanstack/react-query"
import { useSession } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

const TRACKS = [
  { label: "Linux",      icon: LinuxLogo,      color: "#22d3ee" },
  { label: "Terraform",  icon: TerraformLogo,  color: "#c084fc" },
  { label: "Jenkins",    icon: JenkinsLogo,    color: "#f97316" },
  { label: "Docker",     icon: DockerLogo,     color: "#38bdf8" },
  { label: "Git",        icon: GitLogo,        color: "#f87171" },
  { label: "Kubernetes", icon: KubernetesLogo, color: "#60a5fa" },
  { label: "Ansible",    icon: AnsibleLogo,    color: "#EE0000" },
]

const FEATURES = [
  { icon: Terminal,   color: "#22d3ee", title: "Real Terminals",         desc: "Every lab opens a live shell inside an isolated Docker container — no multiple choice, no VMs to configure." },
  { icon: ScanLine,   color: "#a78bfa", title: "Automatic Verification", desc: "Click Verify and the platform runs the check scripts inside your container. Each task is PASS or FAIL, with an exact hint." },
  { icon: TrendingUp, color: "#34d399", title: "Your Own Progress",      desc: "Sign in and every lab you pass is saved to your account — pick up where you left off, anywhere." },
]

// ── Animation variants ────────────────────────────────────────────
const heroContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
}

const heroItem: Variants = {
  hidden: { opacity: 0, y: 22 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.25, 0.1, 0.25, 1] } },
}

const featureCard: Variants = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.5, ease: "easeOut" } },
}

const featureContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
}

// ── Demo data ─────────────────────────────────────────────────────
const DEMO_CMDS = [
  "docker pull nginx:alpine",
  "docker run -d -p 80:80 --name webapp nginx:alpine",
  "docker ps",
]

// ── Terminal preview mockup (animated) ───────────────────────────
function TerminalMockup() {
  // phases: -1=waiting, 0–2=typing cmds, 3=idle cursor,
  //         4=verifying (checkedCount ticks 0→3), 5=all done pause, then reset
  const [phase, setPhase]               = useState(-1)
  const [typed, setTyped]               = useState(0)
  const [clicking, setClicking]         = useState(false)
  const [verifying, setVerifying]       = useState(false)
  const [checkedCount, setCheckedCount] = useState(0)  // grows only during verify

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    if (phase === -1) {
      t = setTimeout(() => setPhase(0), 900)
    } else if (phase >= 0 && phase <= 2) {
      // typing one of the 3 commands
      const cmd = DEMO_CMDS[phase]
      if (typed < cmd.length) {
        t = setTimeout(() => setTyped(n => n + 1), 38)
      } else {
        t = setTimeout(() => { setPhase(phase + 1); setTyped(0) }, 480)
      }
    } else if (phase === 3 && !clicking) {
      // idle cursor — wait, then simulate button click
      t = setTimeout(() => setClicking(true), 1200)
    } else if (phase === 3 && clicking) {
      // brief press visual, then start verifying
      t = setTimeout(() => { setClicking(false); setVerifying(true); setPhase(4) }, 170)
    } else if (phase === 4) {
      if (checkedCount < 3) {
        t = setTimeout(() => setCheckedCount(n => n + 1), 220)
      } else {
        t = setTimeout(() => { setVerifying(false); setPhase(5) }, 400)
      }
    } else if (phase === 5) {
      t = setTimeout(() => { setPhase(-1); setTyped(0); setClicking(false); setCheckedCount(0) }, 2600)
    }
    return () => clearTimeout(t)
  }, [phase, typed, clicking, checkedCount])

  // objectives only check off during VERIFY, never from typing
  const objectives = [
    { label: "Pull nginx:alpine image",     done: checkedCount > 0 },
    { label: "Start container on port 80",  done: checkedCount > 1 },
    { label: "Verify container is healthy", done: checkedCount > 2 },
  ]

  const Cursor = () => (
    <span
      className="inline-block w-[7px] h-[13px] ml-px align-middle rounded-sm animate-pulse"
      style={{ background: "#22c55e", opacity: 0.85 }}
    />
  )
  const P = () => <span style={{ color: "#22c55e" }}>$ </span>

  const btnReady = !verifying

  return (
    <div
      className="rounded-xl overflow-hidden text-left select-none w-full"
      style={{ boxShadow: "0 0 0 1px rgba(34,211,238,0.10), 0 20px 60px rgba(0,0,0,0.55), 0 0 50px rgba(124,58,237,0.06)" }}
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 h-9 shrink-0" style={{ background: "#1a1d24", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#ff5f57" }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#febc2e" }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#28c840" }} />
        <div className="flex-1 mx-3">
          <div className="max-w-[280px] mx-auto h-[22px] rounded flex items-center justify-center gap-1.5 text-xs" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.28)" }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#22c55e" }} />
            devlabmaster.io/labs/docker-d2-deploy
          </div>
        </div>
      </div>

      {/* Workspace top bar */}
      <div className="flex items-center gap-2.5 px-4 h-11 shrink-0" style={{ background: "#0f1117", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="flex items-center gap-1 text-xs font-semibold text-white/25">
          <ArrowRight className="w-3 h-3 rotate-180" /> BACK
        </span>
        <div className="w-px h-3.5 bg-white/[0.07]" />
        <Terminal className="w-3 h-3 shrink-0" style={{ color: "#22d3ee" }} />
        <span className="text-[11.5px] font-semibold text-white/85">Deploy a Web Service</span>
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "rgba(249,115,22,0.12)", color: "#f97316", border: "1px solid rgba(249,115,22,0.22)" }}>INTERMEDIATE</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="flex items-center gap-1 text-xs font-bold px-2 py-[3px] rounded" style={{ background: "rgba(34,211,238,0.09)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.2)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" /> ACTIVE
          </span>
          <span className="text-xs px-2 py-[3px] rounded text-white/22 border border-white/[0.06]">STOP</span>
          <span className="text-xs px-2 py-[3px] rounded text-white/22 border border-white/[0.06]">RESET</span>
          <div className="flex items-center gap-1 text-xs text-white/18 ml-0.5">
            CONNECTED <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex" style={{ height: 296 }}>

        {/* Left panel */}
        <div className="w-52 shrink-0 flex flex-col" style={{ background: "#0b0e14", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex-1 p-4 space-y-3 overflow-hidden">
            <h3 className="text-[12.5px] font-bold text-white">Scenario</h3>
            <p className="text-[10.5px] leading-relaxed" style={{ color: "rgba(255,255,255,0.42)" }}>
              Deploy a containerised nginx server and verify it serves traffic on port&nbsp;80.
            </p>
            <div className="space-y-2 pt-0.5">
              {objectives.map(({ done, label }) => (
                <div key={label} className="flex items-start gap-2">
                  {done
                    ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 transition-colors duration-300" style={{ color: "#22c55e" }} />
                    : <Circle       className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "rgba(255,255,255,0.15)" }} />}
                  <span
                    className="text-[10.5px] leading-snug transition-all duration-300"
                    style={{
                      color: done ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.5)",
                      textDecorationLine: done ? "line-through" : "none",
                      textDecorationColor: "rgba(255,255,255,0.18)",
                    }}
                  >{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Verify button */}
          <div className="p-3 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div
              className="w-full py-2.5 rounded-lg flex items-center justify-center gap-1.5 text-[10.5px] font-bold"
              style={{
                background: verifying ? "rgba(34,211,238,0.75)" : btnReady ? "#22d3ee" : "rgba(34,211,238,0.22)",
                color: "#0a0e14",
                transform: clicking ? "scale(0.96)" : "scale(1)",
                opacity: clicking ? 0.8 : 1,
                transition: "transform 80ms ease, opacity 80ms ease, background 200ms ease",
              }}
            >
              <ScanLine className={cn("w-3 h-3", verifying && "animate-spin")} />
              {verifying ? "VERIFYING..." : "VERIFY_OBJECTIVES"}
            </div>
          </div>
        </div>

        {/* Terminal */}
        <div className="flex-1 flex flex-col min-w-0" style={{ background: "#080b10" }}>
          {/* Tab strip */}
          <div className="flex items-center px-3 pt-1.5 shrink-0" style={{ background: "#0d1018", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="flex items-center gap-1.5 px-2.5 py-[5px] text-xs font-medium rounded-t" style={{ background: "#080b10", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.07)", borderBottom: "1px solid #080b10", marginBottom: -1 }}>
              <Terminal className="w-2.5 h-2.5" style={{ color: "#22d3ee" }} />
              devops-sandbox
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#22d3ee" }} />
            </div>
          </div>

          {/* Server banner */}
           <div className="px-3.5 py-1.5 shrink-0 text-xs font-semibold" style={{ background: "rgba(139,92,246,0.28)", color: "#c4b5fd" }}>
             devops-sandbox
          </div>

          {/* Output */}
          <div className="flex-1 p-3.5 font-mono text-xs leading-[1.65] overflow-hidden" style={{ background: "#080b10", color: "rgba(255,255,255,0.5)" }}>
            <div style={{ color: "#22c55e" }}>Connected to devops-sandbox. Container ready.</div>

            {/* CMD 0 */}
            {phase >= 0 && <div>
              <P /><span style={{ color: "rgba(255,255,255,0.85)" }}>{phase === 0 ? DEMO_CMDS[0].slice(0, typed) : DEMO_CMDS[0]}</span>
              {phase === 0 && <Cursor />}
            </div>}

            {/* Output 0 + CMD 1 */}
            {phase >= 1 && <>
              <div><span style={{ color: "#60a5fa" }}>Pulling from library/nginx</span></div>
              <div>Status: <span style={{ color: "#22c55e" }}>Downloaded</span> newer image for nginx:alpine</div>
              <div>
                <P /><span style={{ color: "rgba(255,255,255,0.85)" }}>{phase === 1 ? DEMO_CMDS[1].slice(0, typed) : DEMO_CMDS[1]}</span>
                {phase === 1 && <Cursor />}
              </div>
            </>}

            {/* Output 1 + CMD 2 */}
            {phase >= 2 && <>
              <div style={{ color: "rgba(255,255,255,0.38)" }}>3f8c2a1b9e47</div>
              <div>
                <P /><span style={{ color: "rgba(255,255,255,0.85)" }}>{phase === 2 ? DEMO_CMDS[2].slice(0, typed) : DEMO_CMDS[2]}</span>
                {phase === 2 && <Cursor />}
              </div>
            </>}

            {/* Output 2 + idle cursor */}
            {phase >= 3 && <>
              <div style={{ color: "rgba(255,255,255,0.32)", fontSize: "10.5px" }}>CONTAINER ID   IMAGE          STATUS       PORTS</div>
              <div style={{ fontSize: "10.5px" }}>3f8c2a1b9e47   <span style={{ color: "#60a5fa" }}>nginx:alpine</span>   Up 3s   <span style={{ color: "#34d399" }}>0.0.0.0:80→80/tcp</span></div>
              {(phase === 3 || phase >= 5) && <div><P /><Cursor /></div>}
            </>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
export default function Home() {
  useMeta("DevLabMaster — Master DevOps. One lab at a time.", "Hands-on DevOps labs for Linux, Terraform, Docker, Kubernetes and more. No VM setup required.")
  const { data: session, isPending } = useSession()
  const { data: stats } = useQuery<{ labs: number; tracks: number }>({
    queryKey: ["stats"],
    queryFn: () => fetch("/api/stats").then(r => r.json()),
    staleTime: 60_000,
  })
  const labCount   = stats?.labs   ?? null
  const trackCount = stats?.tracks ?? null

  if (!isPending && session?.user) return <Redirect to="/dashboard" />

  return (
    <div className="dlm-noise bg-background text-foreground">

      {/* ── Background orbs ── */}
      <BackgroundOrbs />

      {/* ── Top Bar ── */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="sticky top-0 z-20 border-b border-primary/20 bg-primary/8 dark:bg-primary/[0.07] backdrop-blur-md"
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={`${basePath}/logo.svg`} className="w-9 h-9 rounded-xl" />
            <span className="font-bold text-sm tracking-tight">DevLabMaster</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/pricing" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Pricing</Link>
            <ThemeToggle />
            <Link href="/sign-in" className="text-sm font-semibold whitespace-nowrap text-muted-foreground hover:text-foreground transition-colors px-2 sm:px-3 py-2">
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="text-sm font-bold whitespace-nowrap px-3 sm:px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-[0_2px_16px_rgba(13,148,136,0.25)]"
            >
              Get Started
            </Link>
          </div>
        </div>
      </motion.header>

      {/* ── Hero ── */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-20 sm:pt-28 pb-16 text-center">
        <motion.div variants={heroContainer} initial="hidden" animate="show">

          {/* Badge */}
          <motion.div variants={heroItem} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/60 text-xs font-mono font-semibold text-muted-foreground mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
            {labCount !== null ? `${labCount} labs across ${trackCount} tracks` : "Labs across 7 tracks"}
          </motion.div>

          {/* Headline */}
          <motion.h1 variants={heroItem} className="text-5xl sm:text-7xl lg:text-[5.5rem] font-bold tracking-tight leading-[1.01] max-w-5xl mx-auto">
            Learn DevOps by{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
              doing it for real
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p variants={heroItem} className="mt-7 text-foreground/70 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
            Hands-on Linux, Terraform, Jenkins, Docker, Git, and more —<br className="hidden sm:block" /> each one a real terminal, automatically verified.
          </motion.p>


          {/* CTAs */}
          <motion.div variants={heroItem} className="mt-10 flex flex-col items-center gap-4">
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/sign-up"
                className="group px-8 py-3.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:opacity-90 transition-all shadow-[0_4px_20px_rgba(13,148,136,0.28)] flex items-center gap-2"
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
          </motion.div>
          <motion.div variants={heroItem} className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-mono text-muted-foreground/70">
            <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> isolated containers</span>
            <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> objective-level feedback</span>
            <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-secondary" /> progress that persists</span>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Product preview ── */}
      <motion.section
        className="relative z-10 max-w-5xl mx-auto px-6 pb-20"
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.55, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <TerminalMockup />
      </motion.section>

      {/* ── How it works ── */}
      <motion.section
        className="relative z-10 max-w-4xl mx-auto px-6 pb-20"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <p className="text-center dlm-kicker mb-3">
          How it works
        </p>
        <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight mb-14">
          From zero to verified in minutes
        </h2>

        {(() => {
          const steps = [
            { num: 1, icon: Layers,     title: "Pick a track",        desc: "Linux, Docker, Terraform, Git, Jenkins, and more — each broken into progressive labs." },
            { num: 2, icon: Terminal,   title: "Open a real terminal", desc: "A live shell in an isolated Docker container. No VMs, no local setup." },
            { num: 3, icon: CheckCheck, title: "Verify your work",     desc: "Hit Verify. Check scripts run inside your container and tell you exactly what passed." },
          ]
          return (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-8 sm:gap-0">
              {steps.map(({ num, icon: Icon, title, desc }, i) => (
                <Fragment key={num}>
                  {/* step column */}
                  <motion.div
                    className="flex-1 flex flex-col items-center text-center px-3"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.12, ease: [0.25, 0.1, 0.25, 1] }}
                  >
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center mb-5 shrink-0"
                      style={{
                        background: "linear-gradient(135deg, rgba(13,148,136,0.22) 0%, rgba(13,148,136,0.08) 100%)",
                        border: "1.5px solid rgba(13,148,136,0.45)",
                        boxShadow: "0 0 20px rgba(13,148,136,0.12)",
                      }}
                    >
                      <Icon className="w-6 h-6" style={{ color: "#2dd4bf" }} />
                    </div>
                    <span className="text-xs font-black tracking-widest uppercase mb-1.5" style={{ color: "rgba(13,148,136,0.55)" }}>
                      Step {num}
                    </span>
                    <h3 className="font-bold text-sm mb-2">{title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                  </motion.div>

                  {/* arrow between steps */}
                  {i < 2 && (
                    <div className="hidden sm:flex items-center shrink-0 mt-[20px]">
                      <div className="w-8 h-px" style={{ background: "rgba(13,148,136,0.3)" }} />
                      <ArrowRight className="w-3.5 h-3.5 -ml-0.5" style={{ color: "rgba(13,148,136,0.35)" }} />
                    </div>
                  )}
                </Fragment>
              ))}
            </div>
          )
        })()}
      </motion.section>

      {/* ── Track marquee ── */}
      <section className="relative z-10 w-full mb-12">
        <motion.p
          className="text-center dlm-kicker mb-5"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        >
          Tracks
        </motion.p>
        <div
          className="overflow-hidden"
          style={{
            maskImage: "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
          }}
        >
          <div
            className="flex"
            style={{ animation: "marquee-rtl 20s linear infinite", willChange: "transform" }}
          >
            {[...TRACKS, ...TRACKS].map(({ label, icon: Icon, color }, i) => (
              <div
                key={i}
                className="flex items-center justify-center gap-3 shrink-0 select-none py-3"
                style={{ width: "calc(100vw / 7)" }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${color}18`, border: `1.5px solid ${color}35` }}
                >
                  <Icon className="w-6 h-6" style={{ color }} />
                </div>
                <span className="text-base font-semibold tracking-tight text-foreground/70 whitespace-nowrap">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <style>{`
          @keyframes marquee-rtl {
            0%   { transform: translateX(0); }
            100% { transform: translateX(-100vw); }
          }
        `}</style>
      </section>

      {/* ── Features ── */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-24">
        <p className="text-center dlm-kicker mb-3">
          Why it works
        </p>
        <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight mb-10">
          Built for real learning
        </h2>
        <motion.div
          className="grid sm:grid-cols-3 gap-6"
          variants={featureContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
        >
          {FEATURES.map(({ icon: Icon, color, title, desc }) => (
            <motion.div
              key={title}
              variants={featureCard}
              whileHover={{ y: -5, boxShadow: "0 12px 32px rgba(0,0,0,0.09)", transition: { duration: 0.2 } }}
              className="rounded-2xl border border-border bg-card/60 p-6 group cursor-default"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                style={{ background: `${color}18`, border: `1.5px solid ${color}35` }}
              >
                <Icon className="w-5 h-5" style={{ color }} />
              </div>
              <h3 className="font-bold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Footer gradient bleed ── */}
      <div className="h-32 pointer-events-none" style={{ background: "radial-gradient(ellipse at bottom left, rgba(13,148,136,0.07) 0%, transparent 70%)" }} />

      {/* ── Footer ── */}
      <motion.footer
        className="relative z-10 border-t border-primary/20 py-4 bg-primary/8 dark:bg-primary/[0.07] backdrop-blur-md"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>DevLabMaster — DevOps practice range</span>
          <div className="flex items-center gap-6">
            <Link href="/about" className="hover:text-foreground transition-colors">About</Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          </div>
        </div>
      </motion.footer>
    </div>
  )
}
