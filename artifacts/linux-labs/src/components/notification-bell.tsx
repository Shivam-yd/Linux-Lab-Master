import { useState, useEffect, useRef } from "react"
import { Bell, CheckCircle2, AlertCircle, ServerCrash } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { useSession } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

interface Notification {
  id: string
  title: string
  message: string
  severity: "error" | "warn"
}

function useHealthNotifications(): Notification[] {
  const [notes, setNotes] = useState<Notification[]>([])

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch(`${basePath}/api/health`, { credentials: "include" })
        if (!res.ok) throw new Error()
        const data = await res.json() as { ok: boolean; db: string }
        setNotes(data.db !== "ok" ? [{ id: "db", title: "Database error", message: "The database is unreachable. Some features may not work.", severity: "error" }] : [])
      } catch {
        setNotes([{ id: "api", title: "Server unreachable", message: "Cannot connect to the API server.", severity: "error" }])
      }
    }
    check()
    const t = setInterval(check, 60_000)
    return () => clearInterval(t)
  }, [])

  return notes
}

export function NotificationBell() {
  const { data: session } = useSession()
  const { data: adminCheck } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["admin", "check"],
    queryFn: () => fetch(`${basePath}/api/admin/check`, { credentials: "include" }).then(r => r.json()),
    enabled: !!session?.user,
    staleTime: 5 * 60 * 1000,
  })

  const notes = useHealthNotifications()
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const count = notes.length
  const hasNew = count > 0 && !seen

  // Reset "seen" when new errors appear
  useEffect(() => { if (count > 0) setSeen(false) }, [count])

  useEffect(() => {
    const onMouse = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey   = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onMouse)
    document.addEventListener("keydown", onKey)
    return () => { document.removeEventListener("mousedown", onMouse); document.removeEventListener("keydown", onKey) }
  }, [])

  if (!adminCheck?.isAdmin) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(o => !o); setSeen(true) }}
        aria-label={`Notifications${count > 0 ? ` (${count})` : ""}`}
        className={cn(
          "relative w-9 h-9 rounded-lg border flex items-center justify-center transition-all duration-200",
          open
            ? "border-primary/60 bg-primary/10 text-primary"
            : "border-border/60 bg-muted text-foreground hover:border-primary/50 hover:bg-muted/70"
        )}
      >
        <Bell className="w-4 h-4" />
        {count > 0 && (
          <span className={cn(
            "absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full text-[10px] font-bold flex items-center justify-center bg-rose-500 text-white",
            hasNew && "animate-bounce"
          )}>
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-80 rounded-xl border border-border/80 bg-card shadow-2xl shadow-black/30 overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border/50 bg-muted/20 flex items-center justify-between">
            <span className="text-sm font-semibold">Notifications</span>
            {count > 0 && <span className="text-xs text-muted-foreground">{count} active issue{count !== 1 ? "s" : ""}</span>}
          </div>

          {/* Body */}
          {count === 0 ? (
            <div className="px-4 py-8 flex flex-col items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="w-8 h-8 text-green-500/70" />
              <p className="text-sm font-medium">All systems operational</p>
              <p className="text-xs text-muted-foreground/60">No issues detected</p>
            </div>
          ) : (
            <div className="p-1.5 space-y-0.5">
              {notes.map(n => (
                <div key={n.id} className="flex items-start gap-3 px-3 py-3 rounded-lg bg-rose-500/5 border border-rose-500/10">
                  {n.id === "api"
                    ? <ServerCrash className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{n.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{n.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-border/50 bg-muted/10">
            <p className="text-[10px] text-muted-foreground/50 font-mono">Checks every 60 s · GET /api/health</p>
          </div>
        </div>
      )}
    </div>
  )
}
