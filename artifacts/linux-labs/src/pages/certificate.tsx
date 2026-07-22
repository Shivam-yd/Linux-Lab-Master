import { useMemo, useState, useEffect } from "react"
import { useParams, Link } from "wouter"
import { useListLabs, useListProgress } from "@workspace/api-client-react"
import { useSession } from "@/lib/auth-client"
import { ArrowLeft, Printer, Award, CheckCircle2 } from "lucide-react"
import { AccountDropdown } from "@/components/account-dropdown"
import { TRACK_META, DEFAULT_TRACK_META } from "@/lib/track-meta"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

function formatLongDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

const LEVEL_META: Record<number, { tier: string; description: string }> = {
  1: { tier: "Beginner",     description: "demonstrated foundational proficiency in core concepts and hands-on lab exercises" },
  2: { tier: "Intermediate", description: "demonstrated intermediate mastery through advanced hands-on lab exercises" },
  3: { tier: "Advanced",     description: "demonstrated advanced expertise through complex, real-world lab scenarios" },
}

const TRACK_SKILLS: Record<string, string> = {
  linux:     "command-line operations, file system management, permissions, process control, and shell scripting",
  docker:    "container lifecycle management, image building, Dockerfiles, networking, and volume management",
  git:       "version control workflows, branching strategies, merging, rebasing, and collaborative development",
  terraform: "infrastructure as code, resource provisioning, state management, and cloud automation",
  jenkins:   "CI/CD pipeline design, job configuration, build automation, and deployment orchestration",
}

async function makeCertId(studentId: string, track: string, level?: string): Promise<string> {
  const key = level ? `${studentId}:${track}:level:${level}` : `${studentId}:${track}`
  const data = new TextEncoder().encode(key)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hash))
    .slice(0, 8)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()
}

export default function CertificatePage() {
  const { track, level } = useParams<{ track: string; level?: string }>()
  const { data: session } = useSession()
  const { data: labs,     isLoading: labsLoading }     = useListLabs()
  const { data: progress, isLoading: progressLoading } = useListProgress()
  const [certId, setCertId] = useState("")

  const loading = labsLoading || progressLoading

  const tm     = TRACK_META[track ?? ""] ?? { ...DEFAULT_TRACK_META, label: track ?? "Unknown" }
  const Icon   = tm.icon
  const levelNum  = level ? Number(level) : undefined
  const levelMeta = levelNum ? (LEVEL_META[levelNum] ?? { tier: `Level ${levelNum}`, description: "completed all required lab exercises" }) : undefined
  const skills    = TRACK_SKILLS[track ?? ""] ?? "hands-on technical lab exercises"

  const { passed, total, lastPassedAt, isComplete } = useMemo(() => {
    if (!labs || !progress) return { passed: 0, total: 0, lastPassedAt: null, isComplete: false }
    const byLabId = Object.fromEntries(progress.map(p => [p.labId, p]))
    const scopedLabs = labs.filter(l => l.track === track && (levelNum == null || l.level === levelNum))
    const passedLabs = scopedLabs.filter(l => byLabId[l.id]?.status === "passed")
    const dates = passedLabs.map(l => byLabId[l.id]?.lastAttemptAt).filter(Boolean) as string[]
    return {
      passed: passedLabs.length,
      total: scopedLabs.length,
      lastPassedAt: dates.length > 0 ? dates.sort().at(-1)! : null,
      isComplete: passedLabs.length === scopedLabs.length && scopedLabs.length > 0,
    }
  }, [labs, progress, track, levelNum])

  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "Student"

  useEffect(() => {
    const sid = session?.user?.id
    if (!sid || !track) return
    makeCertId(sid, track, level).then(setCertId)
  }, [session?.user?.id, track, level])

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
            Complete all {tm.label}{levelMeta ? ` ${levelMeta.tier}` : ""} labs to unlock your certificate.
            You've passed {passed} of {total} so far.
          </p>
        </div>
        <Link href={`${basePath}/dashboard?track=${track}`} className="text-sm text-primary hover:underline font-medium">
          Continue labs →
        </Link>
      </div>
    )
  }

  // Scope label: "Linux · Beginner" or "Linux"
  const scopeLabel  = levelMeta ? `${tm.label} · ${levelMeta.tier}` : `${tm.label} Track`
  const achievement = levelMeta
    ? `${levelMeta.tier} ${tm.label}`
    : `${tm.label} Track`
  const bodyText = levelMeta
    ? `has ${levelMeta.description} in`
    : "has successfully completed all hands-on labs in the"

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-foreground">
      {/* Nav */}
      <div className="print:hidden flex items-center justify-between px-6 py-4 border-b border-white/8">
        <Link href={`${basePath}/progress`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4" />
          Progress
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print / Save PDF
          </button>
          <AccountDropdown />
        </div>
      </div>

      {/* Certificate */}
      <div className="flex items-center justify-center min-h-[calc(100vh-65px)] print:min-h-screen p-6 print:p-0">
        <div
          className="cert-card w-full max-w-3xl bg-[#111113] print:bg-white relative overflow-hidden"
          style={{
            borderRadius: "16px",
            boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 0 60px ${tm.accentHex}18, 0 32px 64px rgba(0,0,0,0.5)`,
          }}
        >
          {/* Top accent bar */}
          <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, transparent, ${tm.accentHex}, transparent)` }} />

          {/* Subtle corner watermarks */}
          <div className="absolute top-6 left-6 opacity-5 pointer-events-none" style={{ color: tm.accentHex }}>
            <Icon style={{ width: 96, height: 96 }} />
          </div>
          <div className="absolute bottom-6 right-6 opacity-5 pointer-events-none rotate-180" style={{ color: tm.accentHex }}>
            <Icon style={{ width: 96, height: 96 }} />
          </div>

          <div className="relative px-16 py-14 print:px-12 print:py-10 flex flex-col items-center text-center gap-0">

            {/* Issuer */}
            <div className="flex items-center gap-2.5 mb-8">
              <img src="/logo.svg" className="w-8 h-8 rounded-lg print:hidden" />
              <span className="text-sm font-bold tracking-widest uppercase text-muted-foreground print:text-gray-400">
                DevLabMaster
              </span>
            </div>

            {/* Title */}
            <p
              className="text-[11px] font-bold uppercase tracking-[0.35em] mb-2"
              style={{ color: tm.accentHex }}
            >
              Certificate of Achievement
            </p>

            {/* Divider */}
            <div className="w-24 h-px mb-8" style={{ background: `${tm.accentHex}60` }} />

            {/* Body text */}
            <p className="text-sm text-muted-foreground print:text-gray-500 mb-3">
              This is to certify that
            </p>

            {/* Recipient name */}
            <p
              className="text-5xl font-black tracking-tight leading-none mb-5 print:text-gray-900"
              style={{ fontFamily: "Georgia, serif", letterSpacing: "-0.02em" }}
            >
              {userName}
            </p>

            <p className="text-sm text-muted-foreground print:text-gray-500 mb-1 max-w-md leading-relaxed">
              {bodyText}
            </p>

            {/* Achievement name */}
            <p
              className="text-3xl font-black mb-2 print:text-gray-900"
              style={{ color: tm.accentHex }}
            >
              {achievement}
            </p>

            {/* Skills line */}
            <p className="text-xs text-muted-foreground print:text-gray-500 max-w-sm leading-relaxed mb-10">
              covering {skills}
            </p>

            {/* Divider */}
            <div className="w-full h-px bg-white/6 print:bg-gray-200 mb-8" />

            {/* Footer row — date / seal / cert id */}
            <div className="w-full flex items-center justify-between gap-4">
              {/* Date */}
              <div className="text-left">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 print:text-gray-400 mb-1">
                  Date Awarded
                </p>
                <p className="text-sm font-semibold print:text-gray-800">
                  {lastPassedAt ? formatLongDate(lastPassedAt) : "—"}
                </p>
              </div>

              {/* Centre seal */}
              <div
                className="w-16 h-16 rounded-full border-2 flex items-center justify-center shrink-0"
                style={{ borderColor: `${tm.accentHex}50`, background: `${tm.accentHex}10` }}
              >
                <Icon className="w-7 h-7" style={{ color: tm.accentHex }} />
              </div>

              {/* Cert ID */}
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 print:text-gray-400 mb-1">
                  Certificate ID
                </p>
                <p className="text-xs font-mono font-semibold print:text-gray-700 tracking-wider">
                  {certId ? certId.match(/.{1,4}/g)!.join("-") : "—"}
                </p>
              </div>
            </div>

            {/* Verification */}
            <div className="mt-6 flex items-center gap-1.5 text-[10px] text-muted-foreground/40 print:text-gray-400">
              <CheckCircle2 className="w-3 h-3 text-green-500/60" />
              Verified by DevLabMaster automated lab testing
            </div>

          </div>

          {/* Bottom accent bar */}
          <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, transparent, ${tm.accentHex}60, transparent)` }} />
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          .cert-card {
            box-shadow: none !important;
            border: 1px solid #e5e7eb !important;
            border-radius: 0 !important;
            background: white !important;
            color: #111 !important;
          }
        }
      `}</style>
    </div>
  )
}
