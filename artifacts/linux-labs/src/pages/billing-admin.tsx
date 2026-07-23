import { useState } from "react"
import { Link } from "wouter"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSession } from "@/lib/auth-client"
import { Redirect } from "wouter"
import { ArrowLeft, CreditCard, Users, TrendingDown, Zap, Shield } from "lucide-react"
import { AccountDropdown } from "@/components/account-dropdown"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS ?? "").split(",").map((s: string) => s.trim()).filter(Boolean)

type SubRow = {
  user_id: string; plan: string; status: string
  started_at: string; renews_at: string | null
  trial_ends_at: string | null
  name: string | null; email: string
  override_plan: string | null; override_expires: string | null
}
type Revenue = { active_total: number; starter_active: number; pro_active: number; paid_pro_active: number; churned_30d: number }

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(url, { credentials: "include", ...opts })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

const PLAN_LABEL: Record<string, string> = {
  "linux-starter": "Linux Starter",
  "devops-pro":    "DevOps Pro",
}

function PlanBadge({ plan, override }: { plan: string; override?: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full",
      override
        ? "bg-violet-500/15 text-violet-400 border border-violet-500/25"
        : plan === "devops-pro"
          ? "bg-primary/15 text-primary border border-primary/25"
          : "bg-muted/60 text-muted-foreground border border-border/60"
    )}>
      {override && <Zap className="w-2.5 h-2.5" />}
      {PLAN_LABEL[plan] ?? plan}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const s = { active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", past_due: "bg-amber-500/15 text-amber-400 border-amber-500/25", cancelled: "bg-muted/60 text-muted-foreground border-border/60" }
  return <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", s[status as keyof typeof s] ?? s.cancelled)}>{status.replace("_", " ")}</span>
}

export default function BillingAdmin() {
  const { data: session, isPending } = useSession()
  const qc = useQueryClient()

  const [overrideUser, setOverrideUser] = useState("")
  const [overridePlan, setOverridePlan] = useState("devops-pro")
  const [overrideExpiry, setOverrideExpiry] = useState("")

  if (!isPending && !session?.user) return <Redirect to="/sign-in" />

  const revenue = useQuery<Revenue>({
    queryKey: ["admin", "revenue"],
    queryFn: () => apiFetch("/api/admin/revenue"),
  })
  const subs = useQuery<SubRow[]>({
    queryKey: ["admin", "subscriptions"],
    queryFn: () => apiFetch("/api/admin/subscriptions"),
  })

  const applyOverride = useMutation({
    mutationFn: ({ userId, plan, expiresAt }: { userId: string; plan: string; expiresAt?: string }) =>
      apiFetch(`/api/admin/subscriptions/${userId}/override`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, expiresAt: expiresAt || undefined }),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "subscriptions"] }); setOverrideUser("") },
  })

  const removeOverride = useMutation({
    mutationFn: (userId: string) => apiFetch(`/api/admin/subscriptions/${userId}/override`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "subscriptions"] }),
  })

  const changePlan = useMutation({
    mutationFn: ({ userId, plan }: { userId: string; plan: string }) =>
      apiFetch(`/api/admin/subscriptions/${userId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "subscriptions"] }),
  })

  const changeStatus = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: string }) =>
      apiFetch(`/api/admin/subscriptions/${userId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "subscriptions"] }),
  })

  const stats = [
    { label: "Total subscribers", value: revenue.data?.active_total ?? "—", icon: Users,         color: "text-primary" },
    { label: "Linux Starter",     value: revenue.data?.starter_active ?? "—", icon: CreditCard,   color: "text-muted-foreground" },
    { label: "DevOps Pro",        value: revenue.data?.pro_active ?? "—",     icon: Zap,           color: "text-violet-400" },
    { label: "Paid Pro",          value: revenue.data?.paid_pro_active ?? "—", icon: CreditCard,  color: "text-emerald-400" },
    { label: "Churned (30 d)",    value: revenue.data?.churned_30d ?? "—",    icon: TrendingDown,  color: "text-rose-400" },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-20 h-14 border-b border-border/60 bg-card/80 backdrop-blur-md flex items-center justify-between px-6 gap-4">
        <div className="flex items-center gap-4">
          <Link href={`${basePath}/admin`} className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Admin
          </Link>
          <div className="w-px h-5 bg-border/70" />
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm tracking-tight">Billing</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`${basePath}/admin`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-border/60 bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all duration-150"
          >
            <Shield className="w-4 h-4" />
            Admin
          </Link>
          <ThemeToggle />
          <AccountDropdown />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">


        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center bg-muted/40", color)}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className={cn("text-2xl font-black font-mono", color)}>{revenue.isLoading ? "—" : value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Grant override */}
        <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold">Grant plan override</p>
            <p className="text-xs text-muted-foreground mt-0.5">Manually assign a plan to any user, with optional expiry.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">User ID</label>
              <input
                placeholder="user_…"
                value={overrideUser}
                onChange={e => setOverrideUser(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 transition"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Plan</label>
              <select
                value={overridePlan}
                onChange={e => setOverridePlan(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 transition"
              >
                <option value="linux-starter">Linux Starter</option>
                <option value="devops-pro">DevOps Pro</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Expires (optional)</label>
              <input
                type="date"
                value={overrideExpiry}
                onChange={e => setOverrideExpiry(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 transition"
              />
            </div>
          </div>
          <button
            disabled={!overrideUser || applyOverride.isPending}
            onClick={() => applyOverride.mutate({ userId: overrideUser, plan: overridePlan, expiresAt: overrideExpiry || undefined })}
            className="px-5 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {applyOverride.isPending ? "Applying…" : "Apply override"}
          </button>
        </div>

        {/* Subscribers table */}
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
            <p className="text-sm font-semibold">Subscribers</p>
            {subs.isLoading && <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>}
            {!subs.isLoading && <span className="text-xs text-muted-foreground">{subs.data?.length ?? 0} users</span>}
          </div>

          {!subs.isLoading && (subs.data?.length ?? 0) === 0 && (
            <div className="py-16 flex flex-col items-center gap-2 text-muted-foreground">
              <CreditCard className="w-8 h-8 opacity-30" />
              <p className="text-sm">No subscribers yet</p>
            </div>
          )}

          {(subs.data?.length ?? 0) > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/20 text-xs text-muted-foreground">
                    <th className="text-left px-5 py-3 font-semibold">User</th>
                    <th className="text-left px-4 py-3 font-semibold">Plan</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                    <th className="text-left px-4 py-3 font-semibold">Since</th>
                     <th className="text-left px-4 py-3 font-semibold">Trial / Renews</th>
                    <th className="text-left px-4 py-3 font-semibold">Override</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {subs.data!.map(row => (
                    <tr key={row.user_id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                            {(row.name ?? row.email ?? "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate max-w-[140px]">{row.name ?? row.email}</p>
                            {row.name && <p className="text-[11px] text-muted-foreground truncate max-w-[140px]">{row.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <select
                          value={row.plan}
                          onChange={e => changePlan.mutate({ userId: row.user_id, plan: e.target.value })}
                          className="text-xs px-2 py-1 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
                        >
                          <option value="linux-starter">Linux Starter</option>
                          <option value="devops-pro">DevOps Pro</option>
                        </select>
                      </td>
                       <td className="px-4 py-3.5">
                         <select
                           value={row.status}
                           onChange={e => changeStatus.mutate({ userId: row.user_id, status: e.target.value })}
                           className="text-xs px-2 py-1 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
                         >
                           <option value="active">Active</option>
                           <option value="past_due">Past due</option>
                           <option value="cancelled">Cancelled</option>
                         </select>
                       </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">{new Date(row.started_at).toLocaleDateString()}</td>
                       <td className="px-4 py-3.5 text-xs text-muted-foreground">
                         {row.trial_ends_at
                           ? `Trial ends ${new Date(row.trial_ends_at).toLocaleDateString()}`
                           : row.renews_at ? new Date(row.renews_at).toLocaleDateString() : "—"}
                       </td>
                      <td className="px-4 py-3.5">
                        {row.override_plan
                          ? <PlanBadge plan={row.override_plan} override />
                          : <span className="text-xs text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {row.override_plan && (
                          <button
                            onClick={() => removeOverride.mutate(row.user_id)}
                            className="text-xs text-muted-foreground hover:text-rose-400 transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
