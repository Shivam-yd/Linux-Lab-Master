import { useMeta } from "@/hooks/use-meta"
import { Link } from "wouter"
import { useQuery } from "@tanstack/react-query"
import { useSession } from "@/lib/auth-client"
import { ArrowLeft, Award, ExternalLink } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { TRACK_META, DEFAULT_TRACK_META } from "@/lib/track-meta"
import { AccountDropdown } from "@/components/account-dropdown"
import { ThemeToggle } from "@/components/theme-toggle"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

const LEVEL_META: Record<number, { name: string; accentHex: string }> = {
  1: { name: "Foundation",   accentHex: "#22d3ee" },
  2: { name: "Intermediate", accentHex: "#818cf8" },
  3: { name: "Advanced",     accentHex: "#c084fc" },
}

type Cert = { certId: string; track: string; level: number | null; earnedAt: string; expiresAt: string }

const TRACK_ORDER = ["linux", "terraform", "jenkins", "docker", "git"]

export default function MyCertificatesPage() {
  useMeta("My Certificates — DevLabMaster", undefined, { indexable: false })
  const { data: session } = useSession()

  const { data: certs, isLoading } = useQuery<Cert[]>({
    queryKey: ["certs", "mine"],
    queryFn: () => fetch(`${basePath}/api/certs/mine`, { credentials: "include" }).then(r => r.json()),
    enabled: !!session?.user,
    staleTime: 60_000,
  })

  const byTrack = (certs ?? []).reduce<Record<string, Cert[]>>((acc, c) => {
    ;(acc[c.track] ??= []).push(c)
    return acc
  }, {})
  const tracks = [...TRACK_ORDER.filter(t => t in byTrack), ...Object.keys(byTrack).filter(t => !TRACK_ORDER.includes(t))]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />

      <header className="sticky top-0 z-20 border-b border-primary/20 bg-primary/8 dark:bg-primary/[0.07] backdrop-blur-md">
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href={`${basePath}/progress`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
              <ArrowLeft className="w-4 h-4" />
              Progress
            </Link>
            <div className="w-px h-4 bg-border/60" />
            <div className="flex items-center gap-2">
              <img src={`${basePath}/logo.svg`} className="w-4 h-4 rounded-sm" alt="DevLabMaster logo" />
              <span className="font-bold text-sm tracking-tight">DevLabMaster</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <AccountDropdown />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8 relative z-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Certificates</h1>
          <p className="text-muted-foreground mt-1 text-sm">All earned certificates across tracks and levels</p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : tracks.length === 0 ? (
          <div className="rounded-xl border border-border/50 bg-card/60 px-6 py-12 text-center space-y-2">
            <Award className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">No certificates yet — complete a level or track to earn one.</p>
          </div>
        ) : tracks.map(track => {
          const tm = TRACK_META[track] ?? { ...DEFAULT_TRACK_META, label: track }
          const Icon = tm.icon
          const trackCerts = byTrack[track].slice().sort((a, b) => (a.level ?? 99) - (b.level ?? 99))
          return (
            <section key={track} className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground">
                <Icon className="w-3.5 h-3.5" style={{ color: tm.accentHex }} />
                {tm.label}
              </div>
              <div className="rounded-xl border border-border/50 bg-card/60 overflow-hidden divide-y divide-border/30">
                {trackCerts.map(cert => {
                  const lm = cert.level != null ? (LEVEL_META[cert.level] ?? { name: `Level ${cert.level}`, accentHex: "#94a3b8" }) : null
                  const label = lm ? `${lm.name} · Level ${cert.level}` : "Full Track"
                  const accentHex = lm ? lm.accentHex : tm.accentHex
                  const href = cert.level != null
                    ? `${basePath}/certificate/${cert.track}/level/${cert.level}`
                    : `${basePath}/certificate/${cert.track}`
                  return (
                    <Link key={cert.certId} href={href} className="flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors group">
                      <div className="w-9 h-9 rounded-lg border flex items-center justify-center shrink-0"
                        style={{ background: `${accentHex}10`, borderColor: `${accentHex}30` }}>
                        <Award className="w-4 h-4" style={{ color: accentHex }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{label}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                          {cert.certId.match(/.{1,4}/g)!.join("-")} · earned {new Date(cert.earnedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                    </Link>
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
