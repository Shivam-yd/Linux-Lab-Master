import { useMeta } from "@/hooks/use-meta"
import { Link } from "wouter"
import { Redirect } from "wouter"
import { Terminal, ArrowRight, ScanLine, TrendingUp, CheckCircle2, Circle } from "lucide-react"
import {
  LinuxLogo, TerraformLogo, JenkinsLogo, DockerLogo,
  GitLogo, KubernetesLogo, AnsibleLogo,
} from "@/components/track-logos"
import { motion, type Variants } from "framer-motion"
import { useListLabs } from "@workspace/api-client-react"
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
  { label: "Ansible",    icon: AnsibleLogo,    color: "#34d399" },
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

const trackContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}

const trackCard: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.96 },
  show:   { opacity: 1, y: 0,  scale: 1, transition: { duration: 0.4, ease: "easeOut" } },
}

const featureCard: Variants = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.5, ease: "easeOut" } },
}

const featureContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
}

// ── Terminal preview mockup ───────────────────────────────────────
function TerminalMockup() {
  const prompt = <span style={{ color: "#22c55e" }}>student1@af25b9:~$</span>
  const promptEtc = <span style={{ color: "#22c55e" }}>student1@af25b9:/etc$</span>
  return (
    <div
      className="rounded-xl overflow-hidden text-left select-none w-full"
      style={{
        boxShadow: "0 0 0 1px rgba(34,211,238,0.12), 0 40px 100px rgba(0,0,0,0.7), 0 0 80px rgba(124,58,237,0.07)",
      }}
    >
      {/* ── Browser chrome ── */}
      <div className="flex items-center gap-2 px-4 h-10 shrink-0" style={{ background: "#1c1f26", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full inline-block" style={{ background: "#ff5f57" }} />
          <span className="w-3 h-3 rounded-full inline-block" style={{ background: "#febc2e" }} />
          <span className="w-3 h-3 rounded-full inline-block" style={{ background: "#28c840" }} />
        </div>
        <div className="flex-1 mx-4">
          <div className="max-w-xs mx-auto h-6 rounded-md flex items-center justify-center gap-1.5 px-3 text-[11px]" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }}>
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#22c55e", opacity: 0.8 }} />
            devlabmaster.io/labs/linux-l1-navigation
          </div>
        </div>
      </div>

      {/* ── Workspace top bar ── */}
      <div className="flex items-center gap-3 px-5 h-12 shrink-0" style={{ background: "#0f1117", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button className="flex items-center gap-1.5 text-[11px] font-semibold text-white/40 hover:text-white/70 transition-colors">
          <ArrowRight className="w-3.5 h-3.5 rotate-180" /> BACK
        </button>
        <div className="w-px h-4 bg-white/10" />
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5" style={{ color: "#22d3ee" }} />
          <span className="text-[13px] font-semibold text-white/90">Navigating the Filesystem</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#22d3ee15", color: "#22d3ee", border: "1px solid #22d3ee30" }}>BEGINNER</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg" style={{ background: "#22d3ee18", color: "#22d3ee", border: "1px solid #22d3ee35" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" /> ACTIVE
          </span>
          <span className="text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white/35 border border-white/[0.08]">STOP</span>
          <span className="text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white/35 border border-white/[0.08]">RESET</span>
          <div className="ml-1 flex items-center gap-1.5 text-[11px] text-white/30 font-medium">
            CONNECTED <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex" style={{ height: 420 }}>

        {/* Left panel */}
        <div className="w-72 shrink-0 flex flex-col overflow-hidden" style={{ background: "#0b0e14", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex-1 p-6 overflow-hidden space-y-4">
            <h3 className="text-[15px] font-bold text-white">Scenario</h3>
            <p className="text-[12.5px] leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
              Your team needs to audit server configuration. Explore the filesystem hierarchy and
              locate key files using standard shell navigation commands.
            </p>
            <p className="text-[12.5px] leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
              Your task: navigate to <code className="px-1 py-0.5 rounded text-[11px]" style={{ background: "rgba(34,211,238,0.12)", color: "#22d3ee" }}>/etc</code>,
              find the <code className="px-1 py-0.5 rounded text-[11px]" style={{ background: "rgba(34,211,238,0.12)", color: "#22d3ee" }}>hostname</code> file,
              and confirm the server identity.
            </p>
            <div className="pt-1 space-y-2.5">
              {[
                { done: true,  label: "Navigate to /etc and list contents" },
                { done: true,  label: "Locate the hostname config file" },
                { done: false, label: "Print current working directory" },
                { done: false, label: "List hidden files in home directory" },
              ].map(({ done, label }) => (
                <div key={label} className="flex items-center gap-2.5">
                  {done
                    ? <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "#22c55e" }} />
                    : <Circle       className="w-4 h-4 shrink-0" style={{ color: "rgba(255,255,255,0.15)" }} />}
                  <span className="text-[12px]" style={{ color: done ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.4)", textDecoration: done ? "line-through" : "none", textDecorationColor: "rgba(255,255,255,0.2)" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Verify button */}
          <div className="p-4 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="w-full py-3 rounded-xl flex items-center justify-center gap-2 text-[12px] font-bold cursor-pointer" style={{ background: "#22d3ee", color: "#0a0e14" }}>
              <ScanLine className="w-4 h-4" /> VERIFY_OBJECTIVES
            </div>
          </div>
        </div>

        {/* Right: terminal */}
        <div className="flex-1 flex flex-col min-w-0" style={{ background: "#080b10" }}>
          {/* Tab strip */}
          <div className="flex items-center gap-1 px-3 pt-2 shrink-0" style={{ background: "#0d1018", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-t-lg" style={{ background: "#080b10", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.07)", borderBottom: "1px solid #080b10", marginBottom: -1 }}>
              <Terminal className="w-3 h-3" style={{ color: "#22d3ee" }} />
              server1
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#22d3ee" }} />
            </div>
          </div>

          {/* Purple server banner */}
          <div className="px-4 py-2 shrink-0 flex items-center gap-2 text-[12px] font-semibold text-white/90" style={{ background: "rgba(139,92,246,0.35)" }}>
            <span style={{ color: "#c4b5fd" }}>⬡</span> server1
          </div>

          {/* Terminal output */}
          <div className="flex-1 p-4 overflow-hidden font-mono text-[12.5px] leading-6 space-y-0" style={{ background: "#080b10", color: "rgba(255,255,255,0.55)" }}>
            <div style={{ color: "#22c55e" }}>--- Connected to server1. ---</div>
            <div className="h-2" />
            <div>{prompt} <span style={{ color: "rgba(255,255,255,0.85)" }}>cd /etc && ls -la | head -6</span></div>
            <div>total 1468</div>
            <div>drwxr-xr-x 1 root root  4096 Jul 28 09:12 <span style={{ color: "#60a5fa" }}>.</span></div>
            <div>drwxr-xr-x 1 root root  4096 Jul 28 09:12 <span style={{ color: "#60a5fa" }}>..</span></div>
            <div>-rw-r--r-- 1 root root    13 Jul 28 09:12 <span style={{ color: "rgba(255,255,255,0.85)" }}>hostname</span></div>
            <div>-rw-r--r-- 1 root root   174 Jul 28 09:12 <span style={{ color: "rgba(255,255,255,0.85)" }}>hosts</span></div>
            <div>-rw-r--r-- 1 root root   191 Jul 28 09:12 <span style={{ color: "rgba(255,255,255,0.85)" }}>resolv.conf</span></div>
            <div className="h-1" />
            <div>{promptEtc} <span style={{ color: "rgba(255,255,255,0.85)" }}>cat hostname</span></div>
            <div>af25b946401e</div>
            <div className="h-1" />
            <div className="flex items-center gap-0">{promptEtc} <span className="w-2 h-4 ml-1 inline-block rounded-sm animate-pulse" style={{ background: "#22c55e", opacity: 0.7 }} /></div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Floating orb ─────────────────────────────────────────────────
function Orb({ className, color, xRange, yRange, duration }: {
  className: string
  color: string
  xRange: [number, number]
  yRange: [number, number]
  duration: number
}) {
  return (
    <motion.div
      className={cn("absolute rounded-full pointer-events-none", className)}
      style={{ background: `radial-gradient(circle, ${color} 0%, transparent 70%)` }}
      animate={{ x: [0, xRange[0], xRange[1], 0], y: [0, yRange[0], yRange[1], 0] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut", repeatType: "loop" }}
    />
  )
}

// ─────────────────────────────────────────────────────────────────
export default function Home() {
  useMeta("DevLabMaster — Master DevOps. One lab at a time.", "Hands-on DevOps labs for Linux, Terraform, Docker, Kubernetes and more. No VM setup required.")
  const { data: session, isPending } = useSession()
  const { data: labs } = useListLabs()
  const labCount   = labs?.length ?? null
  const trackCount = labs ? new Set(labs.map(l => l.track)).size : null

  if (!isPending && session?.user) return <Redirect to="/dashboard" />

  return (
    <div className="bg-background text-foreground">

      {/* ── Background orbs ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <Orb className="w-[560px] h-[560px] -top-28 -left-20"
          color="rgba(13,148,136,0.13)" xRange={[28, -14]} yRange={[-18, 10]} duration={14} />
        <Orb className="w-[440px] h-[440px] top-[18%] -right-20"
          color="rgba(124,58,237,0.10)" xRange={[-22, 12]} yRange={[26, -10]} duration={17} />
        <Orb className="w-[360px] h-[360px] bottom-[12%] left-[35%]"
          color="rgba(5,150,105,0.09)"  xRange={[18, -10]} yRange={[14, -20]} duration={20} />
      </div>

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
            <span className="font-bold text-[15px] tracking-tight">DevLabMaster</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/pricing" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Pricing</Link>
            <ThemeToggle />
            <Link href="/sign-in" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-2">
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="text-sm font-bold px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-[0_2px_16px_rgba(13,148,136,0.25)]"
            >
              Get Started
            </Link>
          </div>
        </div>
      </motion.header>

      {/* ── Hero ── */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-20 text-center">
        <motion.div variants={heroContainer} initial="hidden" animate="show">

          {/* Badge */}
          <motion.div variants={heroItem} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/60 text-xs font-mono font-semibold text-muted-foreground mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
            {labCount !== null ? `${labCount} labs across ${trackCount} tracks` : "Labs across 5 tracks"}
          </motion.div>

          {/* Headline */}
          <motion.h1 variants={heroItem} className="text-5xl sm:text-7xl font-bold tracking-tight leading-[1.06] max-w-4xl mx-auto">
            Learn DevOps by{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
              doing it for real
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p variants={heroItem} className="mt-7 text-foreground/80 text-xl max-w-2xl mx-auto leading-relaxed">
            Hands-on Linux, Terraform, Jenkins, Docker, and Git labs —<br className="hidden sm:block" /> each one a real terminal, automatically verified.
          </motion.p>
          <motion.p variants={heroItem} className="mt-3 text-muted-foreground text-sm max-w-md mx-auto">
            Free account to save progress and earn certificates.
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
            <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4">
              Continue as Guest
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Product preview ── */}
      <motion.section
        className="relative z-10 max-w-5xl mx-auto px-6 pb-16"
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.55, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <TerminalMockup />
      </motion.section>

      {/* ── Track marquee ── */}
      <section
        className="relative z-10 w-full overflow-hidden py-5 mb-12"
        style={{
          maskImage: "linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)",
        }}
      >
        <div
          className="flex"
          style={{ animation: "marquee-rtl 20s linear infinite", willChange: "transform" }}
        >
          {/* two copies — one set = 100vw, so we shift exactly -100vw for a seamless loop */}
          {[...TRACKS, ...TRACKS].map(({ label, icon: Icon, color }, i) => (
            <div
              key={i}
              className="flex items-center justify-center gap-3 shrink-0 select-none"
              style={{ width: "calc(100vw / 7)" }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${color}18`, border: `1.5px solid ${color}35` }}
              >
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <span className="text-sm font-semibold tracking-tight text-foreground/70 whitespace-nowrap">{label}</span>
            </div>
          ))}
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
      <footer className="relative z-10 border-t border-primary/20 py-4 bg-primary/8 dark:bg-primary/[0.07] backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-xs font-medium text-muted-foreground">
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
