import { useMemo } from "react"
import { Link } from "wouter"
import { useListLabs, useListProgress } from "@workspace/api-client-react"
import { useSession } from "@/lib/auth-client"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Zap, Trophy, Award, CheckCircle2,
  ArrowLeft, Terminal, Layers, Server, Container, GitBranch, Cpu,
  ExternalLink, Star
} from "lucide-react"
import { cn } from "@/lib/utils"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

const TRACK_META: Record<string, { label: string; icon: React.ElementType; accentHex: string; accentClass: string }> = {
  linux:     { label: "Linux",     icon: Terminal,   accentHex: "#22d3ee", accentClass: "text-cyan-400" },
  terraform: { label: "Terraform", icon: Layers,     accentHex: "#c084fc", accentClass: "text-purple-400" },
  jenkins:   { label: "Jenkins",   icon: Server,     accentHex: "#f97316", accentClass: "text-orange-400" },
  docker:    { label: "Docker",    icon: Container,  accentHex: "#38bdf8", accentClass: "text-sky-400" },
  git:       { label: "Git",       icon: GitBranch,  accentHex: "#f87171", accentClass: "text-red-400" },
}

const LEVEL_META: Record<number, { name: string; accentHex: string }> = {
  1: { name: "Foundation",   accentHex: "#22d3ee" },
  2: { name: "Intermediate", accentHex: "#818cf8" },
  3: { name: "Advanced",     accentHex: "#c084fc" },
}

export default function ProgressPage() {
  const { data: session } = useSession()
  const { data: labs, isLoading: labsLoading } = useListLabs()
  const { data: progress, isLoading: progressLoading } = useListProgress()
  const loading = labsLoading || progressLoading

  const progressByLabId = useMemo(() => {
    if (!progress) return {} as Record<string, { status: string; bestScore: number; lastAttemptAt: string | null }>
    return Object.fromEntries(progress.map(p => [p.labId, p]))
  }, [progress])

  const trackOrder = ["linux", "terraform", "jenkins", "docker", "git"]
  const tracks = useMemo(() => {
    if (!labs) return []
    const seen = new Set(labs.map(l => l.track))
    return [...trackOrder.filter(t => seen.has(t)), ...[...seen].filter(t => !trackOrder.includes(t))]
  }, [labs])

  const overallStats = useMemo(() => {
    if (!labs || !progress) return { passed: 0, total: 0 }
    const passed = labs.filter(l => progressByLabId[l.id]?.status === "passed").length
    return { passed, total: labs.length }
  }, [labs, progress, progressByLabId])

  const overallPct = overallStats.total > 0 ? Math.round((overallStats.passed / overallStats.total) * 100) : 0

  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "Student"

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href={`${basePath}/dashboard`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Link>
            <div className="w-px h-4 bg-border/60" />
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="font-bold text-sm tracking-tight">LinuxLabMaster</span>
            </div>
          </div>
          <Link href={`${basePath}/profile`} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Profile
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-10 relative z-10">

        {/* Hero stats */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your Progress</h1>
            <p className="text-muted-foreground mt-1 text-sm">{userName} · all labs across all tracks</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-card px-5 py-4 flex items-center gap-5 shrink-0">
            <Trophy className="w-7 h-7 text-amber-400" />
            <div>
              <p className="text-2xl font-black font-mono leading-none">
                {loading ? "…" : `${overallStats.passed}/${overallStats.total}`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Labs completed</p>
              <Progress value={overallPct} className="h-1.5 mt-2 w-32 bg-background border border-border/50" />
            </div>
          </div>
        </div>

        {/* Per-track sections */}
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-8 w-40" />
              <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
                {Array.from({ length: 4 }).map((_, j) => <Skeleton key={j} className="h-12 border-b border-border/30 rounded-none" />)}
              </div>
            </div>
          ))
        ) : tracks.map(track => {
          const tm = TRACK_META[track] ?? { label: track, icon: Cpu, accentHex: "#94a3b8", accentClass: "text-slate-400" }
          const Icon = tm.icon
          const trackLabs = (labs ?? [])
            .filter(l => l.track === track)
            .sort((a, b) => a.level - b.level || a.order - b.order)
          const passed   = trackLabs.filter(l => progressByLabId[l.id]?.status === "passed").length
          const total    = trackLabs.length
          const pct      = total > 0 ? Math.round((passed / total) * 100) : 0
          const complete = passed === total && total > 0

          return (
            <section key={track} className="space-y-3">
              {/* Track header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg border flex items-center justify-center"
                    style={{ background: `${tm.accentHex}10`, borderColor: `${tm.accentHex}30` }}>
                    <Icon className={cn("w-4 h-4", tm.accentClass)} />
                  </div>
                  <h2 className="text-lg font-bold">{tm.label}</h2>
                  {complete && <Award className="w-4 h-4 text-amber-400" />}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-mono text-muted-foreground">{passed}/{total}</span>
                  <Progress value={pct} className="w-24 h-1.5 bg-background border border-border/50" />
                  {complete && (
                    <Link
                      href={`${basePath}/certificate/${track}`}
                      className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      <Star className="w-3.5 h-3.5" />
                      Certificate
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>

              {/* Level rows */}
              <div className="rounded-xl border border-border/50 bg-card/80 overflow-hidden divide-y divide-border/30">
                {[...new Set(trackLabs.map(l => l.level))].sort().map(lvl => {
                  const lm = LEVEL_META[lvl] ?? { name: `Level ${lvl}`, accentHex: "#94a3b8" }
                  const lvlLabs = trackLabs.filter(l => l.level === lvl)
                  const lvlPassed = lvlLabs.filter(l => progressByLabId[l.id]?.status === "passed").length
                  const lvlTotal  = lvlLabs.length
                  const lvlPct    = lvlTotal > 0 ? Math.round((lvlPassed / lvlTotal) * 100) : 0
                  const lvlDone   = lvlPassed === lvlTotal && lvlTotal > 0

                  return (
                    <div key={lvl} className="flex items-center gap-5 px-5 py-4">
                      {/* Level badge */}
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                        style={{ background: `${lm.accentHex}10`, borderColor: `${lm.accentHex}30` }}
                      >
                        <span className="text-sm font-black font-mono" style={{ color: lm.accentHex }}>
                          L{lvl}
                        </span>
                      </div>

                      {/* Name + lab count */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold leading-none">{lm.name}</span>
                          {lvlDone && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                        </div>
                        <Progress
                          value={lvlPct}
                          className="h-1.5 bg-background border border-border/50"
                        />
                      </div>

                      {/* Count */}
                      <span className="text-sm font-mono text-muted-foreground shrink-0 w-12 text-right">
                        {lvlPassed}/{lvlTotal}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </main>
    </div>
  )
}
