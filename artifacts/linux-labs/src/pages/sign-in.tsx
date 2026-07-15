import { SignIn } from "@clerk/react"
import { Zap } from "lucide-react"
import { Link } from "wouter"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

export default function SignInPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center gap-8">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_15px_rgba(45,212,191,0.15)]">
            <Zap className="w-5 h-5 text-primary fill-primary/20" />
          </div>
          <span className="text-lg font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
            DevLabs
          </span>
        </Link>
        <SignIn
          routing="path"
          path={`${basePath}/sign-in`}
          signUpUrl={`${basePath}/sign-up`}
        />
      </div>
    </div>
  )
}
