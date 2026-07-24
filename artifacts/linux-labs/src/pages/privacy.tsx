import { useMeta } from "@/hooks/use-meta"
import { Link } from "wouter"
import { ArrowLeft, Zap } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

const EFFECTIVE_DATE = "July 22, 2025"

export default function PrivacyPage() {
  useMeta("Privacy Policy — DevLabMaster")
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-primary/20 bg-primary/[0.07] backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link href="/">
            <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </Link>
          <div className="flex-1" />
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold">DevLabMaster</span>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mt-2">Effective {EFFECTIVE_DATE}</p>
        </div>

        <Section title="1. What We Collect">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-foreground">Account data</strong> — email address and display name you provide at sign-up</li>
            <li><strong className="text-foreground">Progress data</strong> — which labs you have started, completed, and your scores</li>
            <li><strong className="text-foreground">Session data</strong> — authentication tokens stored in secure HTTP-only cookies</li>
            <li><strong className="text-foreground">Usage logs</strong> — request timestamps and error logs for debugging (no IP addresses stored permanently)</li>
          </ul>
        </Section>

        <Section title="2. How We Use It">
          <ul className="list-disc pl-5 space-y-1">
            <li>Authenticate you and maintain your session</li>
            <li>Track and display your lab progress and certificates</li>
            <li>Send transactional emails (password reset, email verification)</li>
            <li>Improve the platform based on aggregate usage patterns</li>
          </ul>
          We do not sell your data and do not use it for advertising.
        </Section>

        <Section title="3. Data Storage">
          Your data is stored in a PostgreSQL database hosted on Replit's infrastructure in the
          United States. Passwords are hashed with bcrypt and never stored in plaintext.
        </Section>

        <Section title="4. Cookies">
          We use a single HTTP-only session cookie for authentication. No third-party tracking
          cookies are used.
        </Section>

        <Section title="5. Third-Party Services">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-foreground">Google OAuth</strong> (optional) — if you sign in with Google, your public profile name and email are shared with us by Google under their privacy policy</li>
            <li><strong className="text-foreground">Google Fonts</strong> — fonts are loaded from Google's CDN; Google may log font requests per their policy</li>
          </ul>
        </Section>

        <Section title="6. Your Rights">
          You can:
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Update your display name at any time in your Profile</li>
            <li>Request a copy of your data by contacting us</li>
            <li>Delete your account and all associated data from your Profile page</li>
          </ul>
        </Section>

        <Section title="7. Data Retention">
          If you delete your account, all personal data (email, name, progress, sessions) is
          permanently deleted within 24 hours. Anonymised aggregate statistics may be retained.
        </Section>

        <Section title="8. Changes">
          We may update this policy. The effective date above will reflect the latest revision.
          Continued use of the Service after changes constitutes acceptance.
        </Section>

        <Section title="9. Contact">
          Questions? Reach us via the{" "}
          <Link href="/about">
            <span className="text-primary underline underline-offset-4 cursor-pointer">About page</span>
          </Link>
          .
        </Section>
      </main>

      <footer className="text-center text-xs font-mono text-muted-foreground/50 py-8 border-t border-border/30">
        © {new Date().getFullYear()} DevLabMaster · <Link href="/terms"><span className="hover:text-muted-foreground cursor-pointer transition-colors">Terms of Service</span></Link>
      </footer>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
    </section>
  )
}
