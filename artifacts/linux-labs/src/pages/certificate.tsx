import { useMemo, useState, useEffect } from "react"
import { useMeta } from "@/hooks/use-meta"
import { useParams, Link } from "wouter"
import { useListLabs, useListProgress } from "@workspace/api-client-react"
import { useSession } from "@/lib/auth-client"
import { ArrowLeft, Printer, Award, CheckCircle2, Share2, Check } from "lucide-react"
import { AccountDropdown } from "@/components/account-dropdown"
import { TRACK_META, DEFAULT_TRACK_META } from "@/lib/track-meta"
import { useToast } from "@/hooks/use-toast"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

const LEVEL_META: Record<number, { tier: string; blurb: string }> = {
  1: { tier: "Beginner",     blurb: "demonstrated foundational proficiency through hands-on lab exercises in" },
  2: { tier: "Intermediate", blurb: "demonstrated intermediate mastery through hands-on lab exercises in" },
  3: { tier: "Advanced",     blurb: "demonstrated advanced expertise through hands-on lab exercises in" },
}

const TRACK_SKILLS: Record<string, string> = {
  linux:     "command-line operations, file permissions, process management, and shell scripting",
  docker:    "container lifecycle, image building, Dockerfiles, networking, and volumes",
  git:       "version control workflows, branching, merging, rebasing, and collaboration",
  terraform: "infrastructure as code, resource provisioning, state management, and automation",
  jenkins:   "CI/CD pipeline design, job configuration, build automation, and deployment",
}

async function makeCertId(studentId: string, track: string, level?: string) {
  const key = level ? `${studentId}:${track}:level:${level}` : `${studentId}:${track}`
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key))
  return Array.from(new Uint8Array(hash)).slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase()
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

export default function CertificatePage() {
  const { track, level } = useParams<{ track: string; level?: string }>()
  const { data: session } = useSession()
  const { data: labs,     isLoading: labsLoading }     = useListLabs()
  const { data: progress, isLoading: progressLoading } = useListProgress()
  const [certId, setCertId] = useState("")
  const { toast } = useToast()

  const tm       = TRACK_META[track ?? ""] ?? { ...DEFAULT_TRACK_META, label: track ?? "Unknown" }
  const Icon     = tm.icon
  const levelNum = level ? Number(level) : undefined
  const lm       = levelNum ? (LEVEL_META[levelNum] ?? { tier: `Level ${levelNum}`, blurb: "completed all labs in" }) : undefined
  const skills   = TRACK_SKILLS[track ?? ""] ?? "technical lab exercises"

  const { passed, total, lastPassedAt, isComplete } = useMemo(() => {
    if (!labs || !progress) return { passed: 0, total: 0, lastPassedAt: null, isComplete: false }
    const byId = Object.fromEntries(progress.map(p => [p.labId, p]))
    const scoped = labs.filter(l => l.track === track && (levelNum == null || l.level === levelNum))
    const done   = scoped.filter(l => byId[l.id]?.status === "passed")
    const dates  = done.map(l => byId[l.id]?.lastAttemptAt).filter(Boolean) as string[]
    return { passed: done.length, total: scoped.length, lastPassedAt: dates.sort().at(-1) ?? null, isComplete: done.length === scoped.length && scoped.length > 0 }
  }, [labs, progress, track, levelNum])

  useMeta(`${tm.label} Certificate — DevLabMaster`)

  useEffect(() => {
    const sid = session?.user?.id
    if (!sid || !track || !isComplete || !lastPassedAt) return
    makeCertId(sid, track, level).then(async id => {
      setCertId(id)
      const payload = JSON.stringify({ certId: id, studentName: session?.user?.name || session?.user?.email?.split("@")[0] || "Student", track, level: level ? Number(level) : undefined, earnedAt: lastPassedAt })
      const save = () => fetch(`${basePath}/api/certs`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: payload })
      const res = await save().catch(() => null)
      if (!res?.ok) {
        // retry once after 3 s
        await new Promise(r => setTimeout(r, 3000))
        const retry = await save().catch(() => null)
        if (!retry?.ok) toast({ title: "Certificate not saved", description: "Your certificate was earned but couldn't be registered for public verification. Try reloading the page.", variant: "destructive" })
      }
    })
  }, [session?.user?.id, track, level, isComplete, lastPassedAt])

  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "Student"
  const [copied, setCopied] = useState(false)

  function handleShare() {
    const url = `${window.location.origin}${basePath}/verify/${certId}`
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  if (labsLoading || progressLoading)
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>

  if (!isComplete)
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-5 px-6">
        <Award className="w-14 h-14 text-muted-foreground/30" />
        <div className="text-center">
          <h1 className="text-2xl font-bold">Certificate not yet earned</h1>
          <p className="text-muted-foreground mt-2 text-sm">Complete all {tm.label}{lm ? ` ${lm.tier}` : ""} labs to unlock this. {passed} of {total} passed so far.</p>
        </div>
        <Link href={`${basePath}/dashboard?track=${track}`} className="text-sm text-primary hover:underline">Continue labs →</Link>
      </div>
    )

  const title = lm ? `${tm.label} · ${lm.tier}` : `${tm.label} Track`
  const blurb = lm ? lm.blurb : "has successfully completed all hands-on labs in the"

  return (
    <div className="min-h-screen bg-background text-foreground print:bg-white">
      <header className="print:hidden sticky top-0 z-20 border-b border-primary/20 bg-primary/[0.07] backdrop-blur-md flex items-center justify-between px-6 py-4">
        <Link href={`${basePath}/progress`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" /> Progress
        </Link>
        <div className="flex items-center gap-3">
          {certId && (
            <button onClick={handleShare} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted transition-colors">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
              {copied ? "Copied!" : "Share"}
            </button>
          )}
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
            <Printer className="w-4 h-4" /> Print / Save PDF
          </button>
          <AccountDropdown />
        </div>
      </header>

      <div className="flex items-center justify-center min-h-[calc(100vh-65px)] print:block print:min-h-0 p-8 print:p-6">
        <div className="cert-card w-full max-w-2xl border border-border/60 rounded-2xl bg-card overflow-hidden print:rounded-none print:border print:max-w-none">

          {/* Accent top bar */}
          <div className="h-1" style={{ background: tm.accentHex }} />

          <div className="px-14 py-12 print:px-10 print:py-8 flex flex-col items-center text-center gap-7">

            {/* Issuer */}
            <div className="flex items-center gap-2">
              <img src="/logo.svg" className="w-7 h-7 rounded-lg print:hidden" alt="DevLabMaster" />
              <span className="text-xs font-bold tracking-[0.25em] uppercase text-muted-foreground">DevLabMaster</span>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: tm.accentHex }}>Certificate of Achievement</p>
              <div className="w-12 h-px mx-auto" style={{ background: tm.accentHex }} />
            </div>

            {/* Body */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">This certifies that</p>
              <p className="text-4xl font-black tracking-tight" style={{ fontFamily: "Georgia, serif" }}>{userName}</p>
              <p className="text-sm text-muted-foreground">{blurb}</p>
            </div>

            {/* Course pill */}
            <div className="flex items-center gap-3 px-6 py-3 rounded-xl border" style={{ borderColor: `${tm.accentHex}35`, background: `${tm.accentHex}0d` }}>
              <Icon className="w-6 h-6 shrink-0" style={{ color: tm.accentHex }} />
              <div className="text-left">
                <p className="text-xl font-black" style={{ color: tm.accentHex }}>{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{skills}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="w-full pt-5 border-t border-border/50 flex items-end justify-between">
              <div className="text-left">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">Date Awarded</p>
                <p className="text-sm font-semibold">{lastPassedAt ? fmt(lastPassedAt) : "—"}</p>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40">
                <CheckCircle2 className="w-3 h-3 text-green-500/50" />
                Verified by automated lab testing
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">Certificate ID</p>
                <p className="text-xs font-mono">{certId ? certId.match(/.{1,4}/g)!.join("-") : "—"}</p>
              </div>
            </div>

          </div>

          <div className="h-0.5" style={{ background: `${tm.accentHex}50` }} />
        </div>
      </div>

      <style>{`
        @media print {
          @page { margin: 0; size: A4 portrait; }
          body { margin: 0; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .cert-card { background: white !important; color: black !important; box-shadow: none !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}
