import { useMeta } from "@/hooks/use-meta"
import { Link } from "wouter"
import { ArrowLeft, Zap } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

const EFFECTIVE_DATE = "July 22, 2025"

export default function TermsPage() {
  useMeta("Terms of Service — DevLabMaster")
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
          <h1 className="text-3xl font-black tracking-tight">Terms of Service</h1>
          <p className="text-sm text-muted-foreground mt-2">Effective {EFFECTIVE_DATE}</p>
        </div>

        <Section title="1. Acceptance">
          By creating an account or using DevLabMaster ("the Service"), you agree to these Terms of
          Service. If you do not agree, do not use the Service.
        </Section>

        <Section title="2. Description of Service">
          DevLabMaster provides browser-based, hands-on DevOps training labs covering Linux,
          Terraform, Docker, Jenkins, Git, and related tooling. Labs run inside isolated server-side
          containers. Container availability may vary.
        </Section>

        <Section title="3. Accounts">
          You must provide a valid email address and keep your credentials secure. You are
          responsible for all activity under your account. We reserve the right to suspend or
          terminate accounts that violate these terms.
        </Section>

        <Section title="4. Acceptable Use">
          You agree not to:
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Attempt to escape lab sandboxes or access other users' containers</li>
            <li>Use the Service to store or transmit malicious code</li>
            <li>Scrape, mirror, or resell content without written permission</li>
            <li>Circumvent any rate limits or access controls</li>
          </ul>
        </Section>

        <Section title="5. Intellectual Property">
          All lab content, curricula, and platform code are owned by DevLabMaster. You may not
          reproduce or redistribute them without permission. Your progress data belongs to you.
        </Section>

        <Section title="6. Data & Privacy">
          We collect the data described in our{" "}
          <Link href="/privacy">
            <span className="text-primary underline underline-offset-4 cursor-pointer">Privacy Policy</span>
          </Link>
          . By using the Service you consent to that collection and use.
        </Section>

        <Section title="7. Disclaimers">
          The Service is provided "as is" without warranties of any kind. We do not guarantee
          uninterrupted access or that lab environments will always be available.
        </Section>

        <Section title="8. Limitation of Liability">
          To the maximum extent permitted by law, DevLabMaster is not liable for indirect,
          incidental, or consequential damages arising from your use of the Service.
        </Section>

        <Section title="9. Changes">
          We may update these terms. Continued use of the Service after changes constitutes
          acceptance. We will update the effective date above when changes are made.
        </Section>

        <Section title="10. Contact">
          For questions about these terms, contact us via the{" "}
          <Link href="/about">
            <span className="text-primary underline underline-offset-4 cursor-pointer">About page</span>
          </Link>
          .
        </Section>
      </main>

      <footer className="text-center text-xs font-mono text-muted-foreground/50 py-8 border-t border-border/30">
        © {new Date().getFullYear()} DevLabMaster · <Link href="/privacy"><span className="hover:text-muted-foreground cursor-pointer transition-colors">Privacy Policy</span></Link>
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
