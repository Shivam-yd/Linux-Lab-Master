import { useMemo, useState, useEffect } from "react"
import { useParams, Link } from "wouter"
import { useListLabs, useListProgress } from "@workspace/api-client-react"
import { useSession } from "@/lib/auth-client"
import { ArrowLeft, Printer, Zap, Award, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { TRACK_META, DEFAULT_TRACK_META } from "@/lib/track-meta"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

function formatLongDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
}

/** Deterministic short ID from student + track — no backend needed. */
async function makeCertId(studentId: string, track: string): Promise<string> {
  const data = new TextEncoder().encode(`${studentId}:${track}`)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hash))
    .slice(0, 6)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()
}

export default function CertificatePage() {
  const { track } = useParams<{ track: string }>()
  const { data: session } = useSession()
  const { data: labs,     isLoading: labsLoading }     = useListLabs()
  const { data: progress, isLoading: progressLoading } = useListProgress()
  const [certId, setCertId] = useState("")

  const loading = labsLoading || progressLoading

  const tm = TRACK_META[track ?? ""] ?? { ...DEFAULT_TRACK_META, label: track ?? "Unknown" }
  const Icon = tm.icon

  const { passed, total, lastPassedAt, isComplete } = useMemo(() => {
    if (!labs || !progress) return { passed: 0, total: 0, lastPassedAt: null, isComplete: false }
    const byLabId = Object.fromEntries(progress.map(p => [p.labId, p]))
    const trackLabs = labs.filter(l => l.track === track)
    const passedLabs = trackLabs.filter(l => byLabId[l.id]?.status === "passed")
    const dates = passedLabs.map(l => byLabId[l.id]?.lastAttemptAt).filter(Boolean) as string[]
    const lastPassedAt = dates.length > 0 ? dates.sort().at(-1)! : null
    return {
      passed: passedLabs.length,
      total: trackLabs.length,
      lastPassedAt,
      isComplete: passedLabs.length === trackLabs.length && trackLabs.length > 0,
    }
  }, [labs, progress, track])

  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "Student"

  // Deterministic cert ID — stable across refreshes without a backend
  useEffect(() => {
    const sid = session?.user?.id
    if (!sid || !track) return
    makeCertId(sid, track).then(setCertId)
  }, [session?.user?.id, track])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (!isComplete) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-6 px-6">
        <Award className="w-16 h-16 text-muted-foreground/40" />
        <div className="text-center">
          <h1 className="text-2xl font-bold">Certificate not yet earned</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Complete all {total} {tm.label} labs to unlock your certificate.
            You've passed {passed} so far.
          </p>
        </div>
        <Link href={`${basePath}/dashboard?track=${track}`} className="text-sm text-primary hover:underline font-medium">
          Continue labs →
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav — hidden on print */}
      <div className="print:hidden flex items-center justify-between px-6 py-4 border-b border-border/50">
        <Link href={`${basePath}/progress`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4" />
          Progress
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Printer className="w-4 h-4" />
          Print / Save PDF
        </button>
      </div>

      {/* Certificate */}
      <div className="flex items-center justify-center min-h-[calc(100vh-65px)] print:min-h-screen p-8 print:p-0">
        <div
          className={cn(
            "cert-card w-full max-w-2xl rounded-2xl border-2 bg-card relative overflow-hidden print:rounded-none print:border-4 print:max-w-none print:w-full",
          )}
          style={{ borderColor: tm.accentHex }}
        >
          {/* Background gradient */}
          <div className={cn("absolute inset-0 bg-gradient-to-br opacity-40 pointer-events-none print:hidden", tm.gradient)} />

          {/* Corner accents */}
          <div className="absolute top-0 left-0 w-24 h-24 rounded-br-full opacity-20" style={{ background: tm.accentHex }} />
          <div className="absolute bottom-0 right-0 w-24 h-24 rounded-tl-full opacity-20" style={{ background: tm.accentHex }} />

          <div className="relative z-10 px-12 py-14 flex flex-col items-center text-center gap-8">

            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center print:bg-transparent">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <span className="text-lg font-bold tracking-tight">LinuxLabMaster</span>
            </div>

            {/* Certificate of completion */}
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground print:text-gray-500">Certificate of Completion</p>
              <Award className="w-14 h-14 mx-auto" style={{ color: tm.accentHex }} />
            </div>

            {/* Recipient */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground print:text-gray-500">This certifies that</p>
              <p className="text-4xl font-black tracking-tight leading-none">{userName}</p>
              <p className="text-sm text-muted-foreground print:text-gray-500">has successfully completed all labs in the</p>
            </div>

            {/* Track */}
            <div className="flex items-center gap-3 px-8 py-4 rounded-xl border" style={{ borderColor: `${tm.accentHex}40`, background: `${tm.accentHex}10` }}>
              <Icon className="w-7 h-7 shrink-0" style={{ color: tm.accentHex }} />
              <div className="text-left">
                <p className="text-2xl font-black" style={{ color: tm.accentHex }}>{tm.label}</p>
                <p className="text-xs text-muted-foreground font-medium print:text-gray-500">Track — {total} labs</p>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-8 text-center">
              <div>
                <p className="text-2xl font-black font-mono">{total}</p>
                <p className="text-xs text-muted-foreground mt-0.5 print:text-gray-500">Labs passed</p>
              </div>
              <div className="w-px h-10 bg-border/60" />
              <div>
                <p className="text-2xl font-black font-mono">100%</p>
                <p className="text-xs text-muted-foreground mt-0.5 print:text-gray-500">Track complete</p>
              </div>
              <div className="w-px h-10 bg-border/60" />
              <div>
                <p className="text-sm font-black font-mono leading-tight">
                  {lastPassedAt ? formatLongDate(lastPassedAt) : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 print:text-gray-500">Completed on</p>
              </div>
            </div>

            {/* Verification row */}
            <div className="space-y-1.5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground print:text-gray-500">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                Verified by LinuxLabMaster automated testing
              </div>
              {certId && (
                <p className="text-[10px] font-mono text-muted-foreground/60 print:text-gray-400 tracking-widest">
                  CERT ID: {certId}
                </p>
              )}
            </div>

          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .cert-card {
            background: white !important;
            color: black !important;
            box-shadow: none !important;
          }
          .cert-card .text-muted-foreground { color: #6b7280 !important; }
          .cert-card .text-foreground { color: #111827 !important; }
          .cert-card .bg-card { background: white !important; }
          .cert-card .border-border\\/60 { background: #d1d5db !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}
