import { Link } from "wouter"
import { Redirect } from "wouter"
import {
  Terminal, Layers, Server, Container, GitBranch,
  ArrowRight, ScanLine, TrendingUp,
} from "lucide-react"
import { motion } from "framer-motion"
import { useListLabs } from "@workspace/api-client-react"
import { useSession } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

const TRACKS = [
  { label: "Linux",     icon: Terminal,  color: "#0d9488", iconClass: "group-hover:[animation:flicker_0.6s_ease-in-out_infinite]" },
  { label: "Terraform", icon: Layers,    color: "#7c3aed", iconClass: "group-hover:animate-bounce" },
  { label: "Jenkins",   icon: Server,    color: "#ea580c", iconClass: "group-hover:animate-pulse group-hover:[animation-duration:0.7s]" },
  { label: "Docker",    icon: Container, color: "#0284c7", iconClass: "group-hover:[animation:breathe_1s_ease-in-out_infinite]" },
  { label: "Git",       icon: GitBranch, color: "#dc2626", iconClass: "group-hover:[animation:swing_0.8s_ease-in-out_infinite]" },
]

const FEATURES = [
  { icon: Terminal,   color: "#0d9488", title: "Real Terminals",         desc: "Every lab opens a live shell inside an isolated Docker container — no multiple choice, no VMs to configure." },
  { icon: ScanLine,   color: "#7c3aed", title: "Automatic Verification", desc: "Click Verify and the platform runs the check scripts inside your container. Each task is PASS or FAIL, with an exact hint." },
  { icon: TrendingUp, color: "#059669", title: "Your Own Progress",      desc: "Sign in and every lab you pass is saved to your account — pick up where you left off, anywhere." },
]

// ── Animation variants ────────────────────────────────────────────
const heroContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
}

const heroItem = {
  hidden: { opacity: 0, y: 22 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.25, 0.1, 0.25, 1] } },
}

const trackContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}

const trackCard = {
  hidden: { opacity: 0, y: 18, scale: 0.96 },
  show:   { opacity: 1, y: 0,  scale: 1, transition: { duration: 0.4, ease: "easeOut" } },
}

const featureCard = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.5, ease: "easeOut" } },
}

const featureContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
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
  const { data: session, isPending } = useSession()
  const { data: labs } = useListLabs()
  const labCount   = labs?.length ?? null
  const trackCount = labs ? new Set(labs.map(l => l.track)).size : null

  if (!isPending && session?.user) return <Redirect to="/dashboard" />

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

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
        className="sticky top-0 z-20 border-b border-border/70 bg-white/80 backdrop-blur-md"
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={`${basePath}/logo.svg`} className="w-9 h-9 rounded-xl" />
            <span className="font-bold text-[15px] tracking-tight">DevLabMaster</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/about" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              About
            </Link>
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
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <motion.div variants={heroContainer} initial="hidden" animate="show">

          {/* Badge */}
          <motion.div variants={heroItem} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-white/80 text-xs font-mono font-semibold text-muted-foreground mb-8 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
            {labCount !== null ? `${labCount} labs across ${trackCount} tracks` : "Labs across 5 tracks"}
          </motion.div>

          {/* Headline */}
          <motion.h1 variants={heroItem} className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.1] max-w-3xl mx-auto">
            Learn DevOps by{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
              doing it for real
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p variants={heroItem} className="mt-6 text-muted-foreground text-lg max-w-xl mx-auto leading-relaxed">
            Hands-on Linux, Terraform, Jenkins, Docker, and Git labs — each one a real terminal,
            automatically verified. Create a free account to track your progress.
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
                className="px-8 py-3.5 rounded-xl text-sm font-bold border border-border bg-white hover:bg-muted/60 transition-colors shadow-sm"
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

      {/* ── Tracks ── */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-16">
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-5 gap-4"
          variants={trackContainer}
          initial="hidden"
          animate="show"
        >
          {TRACKS.map(({ label, icon: Icon, color, iconClass }) => (
            <motion.div
              key={label}
              variants={trackCard}
              whileHover={{ y: -3, scale: 1.03, transition: { duration: 0.18 } }}
              className="rounded-xl border border-border bg-white/90 p-5 flex flex-col items-center gap-3 text-center hover:border-primary/40 hover:shadow-md transition-shadow group cursor-default"
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: `${color}18`, border: `1.5px solid ${color}35` }}
              >
                <Icon className={cn("w-5 h-5", iconClass)} style={{ color }} />
              </div>
              <span className="text-sm font-semibold">{label}</span>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Features ── */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
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
              className="rounded-2xl border border-border bg-white/90 p-6 group cursor-default"
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
      <footer className="relative z-10 border-t border-border/70 py-4 bg-white/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>DevLabMaster — DevOps practice range</span>
          <Link href="/about" className="hover:text-foreground transition-colors">About</Link>
        </div>
      </footer>
    </div>
  )
}
