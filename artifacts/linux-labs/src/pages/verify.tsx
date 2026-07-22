import { useEffect, useState } from "react"
import { useParams, Link } from "wouter"
import { CheckCircle2, Award, XCircle, ArrowLeft } from "lucide-react"
import { TRACK_META, DEFAULT_TRACK_META } from "@/lib/track-meta"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

const LEVEL_NAMES: Record<number, string> = { 1: "Beginner", 2: "Intermediate", 3: "Advanced" }

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

type CertRecord = { certId: string; studentName: string; track: string; level: number | null; earnedAt: string }

export default function VerifyPage() {
  const { certId } = useParams<{ certId: string }>()
  const [cert, setCert] = useState<CertRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${basePath}/api/certs/${certId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setCert(data)
        setLoading(false)
        if (data) document.title = `${data.studentName}'s Certificate — DevLabMaster`
      })
      .catch(() => setLoading(false))
  }, [certId])

  if (loading)
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>

  if (!cert)
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-5 px-6">
        <XCircle className="w-14 h-14 text-red-400/60" />
        <div className="text-center">
          <h1 className="text-2xl font-bold">Certificate not found</h1>
          <p className="text-muted-foreground mt-2 text-sm">This certificate ID doesn't exist or hasn't been shared yet.</p>
        </div>
        <Link href={`${basePath}/`} className="text-sm text-primary hover:underline">← Go home</Link>
      </div>
    )

  const tm    = TRACK_META[cert.track] ?? { ...DEFAULT_TRACK_META, label: cert.track }
  const Icon  = tm.icon
  const scope = cert.level ? `${tm.label} · ${LEVEL_NAMES[cert.level] ?? `Level ${cert.level}`}` : `${tm.label} Track`

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="flex items-center px-6 py-4 border-b border-border/50">
        <Link href={`${basePath}/`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" /> DevLabMaster
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md border border-border/60 rounded-2xl bg-card overflow-hidden">
          <div className="h-1" style={{ background: tm.accentHex }} />
          <div className="px-10 py-10 flex flex-col items-center text-center gap-6">

            <div className="w-16 h-16 rounded-full border-2 flex items-center justify-center" style={{ borderColor: `${tm.accentHex}50`, background: `${tm.accentHex}10` }}>
              <Icon className="w-7 h-7" style={{ color: tm.accentHex }} />
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: tm.accentHex }}>Certificate of Achievement</p>
              <p className="text-xs text-muted-foreground">This certifies that</p>
            </div>

            <div className="space-y-1">
              <p className="text-3xl font-black tracking-tight" style={{ fontFamily: "Georgia, serif" }}>{cert.studentName}</p>
              <p className="text-sm text-muted-foreground">has completed</p>
              <p className="text-xl font-black" style={{ color: tm.accentHex }}>{scope}</p>
            </div>

            <div className="w-full pt-5 border-t border-border/50 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{fmt(cert.earnedAt)}</span>
              <div className="flex items-center gap-1.5 text-green-500">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="font-semibold">Verified</span>
              </div>
              <span className="font-mono text-muted-foreground/60">{cert.certId.match(/.{1,4}/g)!.join("-")}</span>
            </div>

          </div>
          <div className="h-0.5" style={{ background: `${tm.accentHex}50` }} />
        </div>
      </div>
    </div>
  )
}
