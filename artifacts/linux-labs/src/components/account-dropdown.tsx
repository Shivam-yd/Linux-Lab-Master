import { useState, useEffect, useRef } from "react"
import { Link } from "wouter"
import { useSession, signOut } from "@/lib/auth-client"
import { User, LogOut, BarChart2, Shield, LogIn, UserPlus } from "lucide-react"
import { cn } from "@/lib/utils"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

export function AccountDropdown() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onMouse)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onMouse)
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  const user = session?.user
  const name = user?.name || user?.email || "Guest"
  const email = user?.email || ""
  const initial = name.charAt(0).toUpperCase()

  const item = (href: string, icon: React.ReactNode, label: string) => (
    <Link
      key={href}
      href={href}
      onClick={() => setOpen(false)}
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-150 group"
    >
      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-muted/60 group-hover:bg-muted transition-colors shrink-0">
        {icon}
      </span>
      {label}
    </Link>
  )

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "w-9 h-9 rounded-lg border flex items-center justify-center transition-all duration-200 text-sm font-bold",
          open
            ? "border-primary/60 bg-primary/10 text-primary"
            : "border-border/60 bg-muted text-foreground hover:border-primary/50 hover:bg-muted/70"
        )}
      >
        {user ? (
          <span className="text-xs font-bold leading-none">{initial}</span>
        ) : (
          <User className="w-4 h-4" />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-64 rounded-xl border border-border/80 bg-card shadow-2xl shadow-black/30 overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">

          {/* Header */}
          <div className="px-4 py-3.5 border-b border-border/50 bg-muted/20">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 border",
                user
                  ? "bg-primary/15 border-primary/30 text-primary"
                  : "bg-muted/50 border-border/60 text-muted-foreground"
              )}>
                {user ? initial : <User className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{user ? name : "Guest"}</p>
                {user && email
                  ? <p className="text-xs text-muted-foreground truncate">{email}</p>
                  : !user && <p className="text-xs text-muted-foreground">Progress saved by cookie</p>
                }
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="p-1.5 space-y-0.5">
            {user ? (
              <>
                {item(`${basePath}/profile`,  <User className="w-3.5 h-3.5" />,     "Profile")}
                {item(`${basePath}/progress`, <BarChart2 className="w-3.5 h-3.5" />, "My Progress")}
                {item(`${basePath}/admin`,    <Shield className="w-3.5 h-3.5" />,    "Admin Panel")}
              </>
            ) : (
              item(`${basePath}/progress`, <BarChart2 className="w-3.5 h-3.5" />, "My Progress")
            )}
          </div>

          {/* Footer action */}
          <div className="p-1.5 border-t border-border/50">
            {user ? (
              <button
                onClick={() => {
                  setOpen(false)
                  // keepalive keeps the request alive after navigation so the
                  // session is cleared on the server even though we redirect immediately.
                  void fetch(`${basePath}/api/auth/sign-out`, { method: "POST", credentials: "include", keepalive: true })
                  window.location.href = basePath || "/"
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors duration-150 group"
              >
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-rose-500/10 group-hover:bg-rose-500/20 transition-colors shrink-0">
                  <LogOut className="w-3.5 h-3.5" />
                </span>
                Sign out
              </button>
            ) : (
              <div className="space-y-0.5">
                {item(`${basePath}/sign-in`, <LogIn className="w-3.5 h-3.5" />,    "Sign in")}
                {item(`${basePath}/sign-up`, <UserPlus className="w-3.5 h-3.5" />, "Create account")}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
