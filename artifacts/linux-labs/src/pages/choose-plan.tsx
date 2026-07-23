import { useEffect, useState } from "react"
import { useLocation, Redirect } from "wouter"
import { useSession } from "@/lib/auth-client"
import { usePlan } from "@/lib/use-plan"
import { Loader2, Terminal, Server } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

const PLANS = [
  {
    id: "linux-starter",
    name: "Linux Starter",
    description: "Master the Linux command line from the ground up.",
    tracks: ["Linux"],
    features: ["All Linux labs", "Progress tracking", "Certificates"],
    Icon: Terminal,
    pro: false,
  },
  {
    id: "devops-pro",
    name: "DevOps Pro",
    description: "Everything in Starter plus all DevOps tracks, with a 14-day Pro trial.",
    tracks: ["Linux", "Docker", "Terraform", "Jenkins", "Git"],
    features: ["All Linux labs", "All DevOps labs", "14-day Pro trial", "Progress tracking", "Certificates"],
    Icon: Server,
    pro: true,
  },
] as const

export default function ChoosePlan() {
  useEffect(() => { document.title = "Choose a Plan — DevLabMaster" }, [])
  const [, setLocation] = useLocation()
  const { data: session, isPending } = useSession()
  const { hasSubscription, isLoading: planLoading } = usePlan()
  const [choosing, setChoosing] = useState<string | null>(null)

  if (!isPending && !session?.user) return <Redirect to="/sign-in" />
  if (!isPending && !planLoading && hasSubscription) return <Redirect to="/dashboard" />

  function choose(plan: string) {
    setChoosing(plan)
    setLocation(`/checkout?plan=${plan}`)
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-2xl">

        <div className="flex items-center gap-3">
          <img src={`${basePath}/logo.svg`} className="w-10 h-10 rounded-xl" alt="DevLabMaster" />
          <span className="text-lg font-bold tracking-tight">DevLabMaster</span>
        </div>

        <div className="text-center">
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary tracking-widest uppercase">Currently Free</span>
          <h1 className="text-2xl font-bold mt-4 mb-2">Choose your learning path</h1>
          <p className="text-sm text-muted-foreground">Pick a plan to unlock your labs. You can change it anytime.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          {PLANS.map(({ id, name, description, tracks, features, Icon, pro }) => (
            <div key={id} className={cn(
              "flex flex-col gap-4 bg-card border rounded-2xl p-6 shadow-sm",
              pro ? "border-primary/40 shadow-[0_0_30px_rgba(45,212,191,0.08)]" : "border-border"
            )}>
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center",
                  pro ? "bg-primary/15" : "bg-cyan-500/15"
                )}>
                  <Icon className={cn("w-5 h-5", pro ? "text-primary" : "text-cyan-400")} />
                </div>
                <div>
                  <p className="font-semibold text-sm">{name}</p>
                  {pro && <span className="text-[10px] text-primary font-medium">Full access</span>}
                </div>
              </div>

              <p className="text-sm text-muted-foreground">{description}</p>

              <ul className="flex flex-col gap-1.5 flex-1">
                {features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", pro ? "bg-primary" : "bg-cyan-400")} />
                    {f}
                  </li>
                ))}
              </ul>

              <p className="text-[11px] text-muted-foreground/50 font-mono">
                Tracks: {tracks.join(" · ")}
              </p>

              <Button
                variant={pro ? "default" : "outline"}
                className="w-full"
                onClick={() => choose(id)}
                disabled={!!choosing}
              >
                {choosing === id && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Choose {name}
              </Button>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
