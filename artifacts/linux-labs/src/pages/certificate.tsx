import { useMemo, useState, useEffect } from "react"
import { useMeta } from "@/hooks/use-meta"
import { useParams, Link } from "wouter"
import { useListLabs, useListProgress } from "@workspace/api-client-react"
import { useSession } from "@/lib/auth-client"
import { ArrowLeft, Printer, Award, CheckCircle2, Share2, Check } from "lucide-react"
import { AccountDropdown } from "@/components/account-dropdown"
import { TRACK_META, DEFAULT_TRACK_META } from "@/lib/track-meta"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"

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

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

function CertificateLoading() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-primary/20 bg-background/80 backdrop-blur-md flex items-center justify-between px-6 py-4">
        <Skeleton className="h-5 w-20" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </header>
      <div className="flex items-center justify-center min-h-[calc(100vh-65px)] p-8">
        <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl shadow-primary/5">
          <Skeleton className="h-1 w-full rounded-none" />
          <div className="px-14 py-12 flex flex-col items-center text-center gap-7">
            <Skeleton className="h-4 w-28" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-36 mx-auto" />
              <Skeleton className="h-px w-12 mx-auto" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-28 mx-auto" />
              <Skeleton className="h-10 w-56 mx-auto" />
              <Skeleton className="h-4 w-72 max-w-full mx-auto" />
            </div>
            <Skeleton className="h-20 w-full max-w-md rounded-xl" />
            <div className="w-full pt-5 border-t border-border/50 flex items-end justify-between gap-4">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
          <Skeleton className="h-0.5 w-full rounded-none" />
        </div>
      </div>
    </div>
  )
}

export default function CertificatePage() {
  const { track, level } = useParams<{ track: string; level?: string }>()
  const { data: session, isPending: sessionLoading } = useSession()
  const { data: labs,     isLoading: labsLoading }     = useListLabs()
  const { data: progress, isLoading: progressLoading } = useListProgress()
  const [certId, setCertId] = useState("")
  const { toast } = useToast()

  const tm       = TRACK_META[track ?? ""] ?? { ...DEFAULT_TRACK_META, label: track ?? "Unknown" }
  const Icon     = tm.icon
  const levelNum = level ? Number(level) : undefined
  const lm       = levelNum ? (LEVEL_META[levelNum] ?? { tier: `Level ${levelNum}`, blurb: "completed all labs in" }) : undefined
  const skills   = TRACK_SKILLS[track ?? ""] ?? "technical lab exercises"
  const title    = lm ? `${tm.label} · ${lm.tier}` : `${tm.label} Track`

  const { passed, total, lastPassedAt, isComplete } = useMemo(() => {
    if (!labs || !progress) return { passed: 0, total: 0, lastPassedAt: null, isComplete: false }
    const byId = Object.fromEntries(progress.map(p => [p.labId, p]))
    const scoped = labs.filter(l => l.track === track && (levelNum == null || l.level === levelNum))
    const done   = scoped.filter(l => byId[l.id]?.status === "passed")
    const dates  = done.map(l => byId[l.id]?.lastAttemptAt).filter(Boolean) as string[]
    return { passed: done.length, total: scoped.length, lastPassedAt: dates.sort().at(-1) ?? null, isComplete: done.length === scoped.length && scoped.length > 0 }
  }, [labs, progress, track, levelNum])

  // Stored cert record — fetched once on load so an already-issued cert is
  // shown even if new labs were added to the track after it was earned.
  type StoredCert = { certId: string; earnedAt: string; expiresAt: string }
  const [storedCert, setStoredCert] = useState<StoredCert | null>(null)
  const [certLoading, setCertLoading] = useState(true)
  useEffect(() => {
    if (!session?.user?.id || !track) {
      setCertLoading(false)
      return
    }

    fetch(`${basePath}/api/certs/mine`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((certs: Array<StoredCert & { track: string; level: number | null }>) => {
        const match = certs.find(c =>
          c.track === track &&
          (levelNum == null ? c.level == null : c.level === levelNum) &&
          new Date(c.expiresAt) > new Date()
        )
        if (match) {
          setStoredCert(match)
          setCertId(match.certId)
        }
      })
      .catch(() => {})
      .finally(() => setCertLoading(false))
  }, [session?.user?.id, track, levelNum])

  useMeta(`${tm.label} Certificate — DevLabMaster`)

  // Register / refresh the cert on the server whenever the student has
  // completed all labs. No-op if the cert already exists (server upserts).
  useEffect(() => {
    if (!session?.user?.id || !track || !isComplete || !lastPassedAt) return
    const payload = JSON.stringify({
      studentName: session.user.name || session.user.email?.split("@")[0] || "Student",
      track,
      level: level ? Number(level) : undefined,
    })
    const save = () => fetch(`${basePath}/api/certs`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: payload })
    save().then(async res => {
      if (res?.ok) {
        const data = await res.json()
        setCertId(data.certId)
      } else {
        // retry once after 3 s
        await new Promise(r => setTimeout(r, 3000))
        const retry = await save().catch(() => null)
        if (retry?.ok) {
          const data = await retry.json()
          setCertId(data.certId)
        } else {
          toast({ title: "Certificate not saved", description: "Earned but couldn't register for public verification. Try reloading.", variant: "destructive" })
        }
      }
    }).catch(() => {})
  }, [session?.user?.id, track, level, isComplete, lastPassedAt])

  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "Student"
  const [copied, setCopied] = useState(false)

  async function copyCertificateUrl(url: string) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url)
        return
      } catch {
        // Clipboard access can be blocked in an embedded preview. Use the
        // document fallback below before reporting an error.
      }
    }

    const textarea = document.createElement("textarea")
    textarea.value = url
    textarea.setAttribute("readonly", "")
    textarea.style.position = "fixed"
    textarea.style.opacity = "0"
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand("copy")
    textarea.remove()

    if (!copied) throw new Error("Clipboard access is unavailable")
  }

  async function handleShare() {
    const url = `${window.location.origin}${basePath}/verify/${certId}`
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${title} Certificate — DevLabMaster`,
          text: `Verify my ${title} certificate`,
          url,
        })
      } else {
        await copyCertificateUrl(url)
      }

      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      toast({
        title: "Couldn't share certificate",
        description: "Copy the verification link from your browser and try again.",
        variant: "destructive",
      })
    }
  }

  if (sessionLoading || labsLoading || progressLoading || certLoading)
    return <CertificateLoading />

  if (!isComplete && !storedCert)
    return (
      <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
        <header className="sticky top-0 z-20 border-b border-primary/20 bg-background/80 backdrop-blur-md flex items-center px-6 py-4">
          <Link href={`${basePath}/progress`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">
            <ArrowLeft className="w-4 h-4" /> Progress
          </Link>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">
          <div className="w-16 h-16 rounded-2xl border border-primary/20 bg-primary/10 flex items-center justify-center">
            <Award className="w-7 h-7 text-primary/70" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold">Certificate not yet earned</h1>
            <p className="text-muted-foreground mt-2 text-sm">Complete all {tm.label}{lm ? ` ${lm.tier}` : ""} labs to unlock this. {passed} of {total} passed so far.</p>
          </div>
          <Link href={`${basePath}/dashboard?track=${track}`} className="text-sm text-primary hover:underline">Continue labs →</Link>
        </div>
      </div>
    )

  const blurb = lm ? lm.blurb : "has successfully completed all hands-on labs in the"

  return (
    <div className="min-h-[100dvh] bg-background text-foreground print:bg-white">
      <header className="print:hidden sticky top-0 z-20 border-b border-primary/20 bg-background/80 backdrop-blur-md flex items-center justify-between px-6 py-4">
        <Link href={`${basePath}/progress`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" /> Progress
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> achievement record
          </span>
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

      <div className="relative flex items-center justify-center min-h-[calc(100dvh-65px)] print:block print:min-h-0 p-4 sm:p-8 print:p-6">
        <div className="absolute inset-0 dlm-grid pointer-events-none print:hidden" />
        <div className="cert-card relative w-full max-w-2xl border border-primary/20 rounded-2xl bg-card overflow-hidden shadow-2xl shadow-primary/10 print:rounded-none print:border print:max-w-none">

          {/* Accent top bar */}
          <div className="h-1" style={{ background: tm.accentHex }} />

          <div className="px-14 py-12 print:px-10 print:py-8 flex flex-col items-center text-center gap-7">

            {/* Issuer */}
            <div className="flex items-center gap-2">
              <img src="/logo.svg" className="w-7 h-7 rounded-lg print:hidden" alt="DevLabMaster" />
              <span className="text-xs font-bold tracking-[0.25em] uppercase text-muted-foreground">DevLabMaster</span>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: tm.accentHex }}>Verified achievement record</p>
              <div className="w-12 h-px mx-auto" style={{ background: tm.accentHex }} />
            </div>

            {/* Body */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">This certifies that</p>
              <p className="text-3xl sm:text-4xl font-black tracking-tight" style={{ fontFamily: "Georgia, serif" }}>{userName}</p>
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
                <p className="text-xs uppercase tracking-widest text-muted-foreground/60 mb-1">Date Awarded</p>
                <p className="text-sm font-semibold">{fmt(storedCert?.earnedAt ?? lastPassedAt ?? "")}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
                <CheckCircle2 className="w-3 h-3 text-green-500/50" />
                Verified by automated lab testing
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-widest text-muted-foreground/60 mb-1">Certificate ID</p>
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
