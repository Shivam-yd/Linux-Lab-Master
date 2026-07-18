import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import {
  userTable,
  sessionTable,
  accountTable,
  verificationTable,
  passwordResetRequestsTable,
} from "@workspace/db/schema";

// Public origin the browser hits — needed so Google can redirect back after OAuth.
// Priority: BETTER_AUTH_URL env var → REPLIT_DEV_DOMAIN → localhost fallback.
const baseURL =
  process.env.BETTER_AUTH_URL ??
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : "http://localhost:8080");

// Collect all trusted origins: baseURL + Replit dev domain + any extras from TRUSTED_ORIGINS.
// TRUSTED_ORIGINS is a comma-separated list, useful for self-hosted deployments where
// the raw IP (e.g. http://59.185.230.105:8085) differs from the public DuckDNS domain.
const trustedOrigins = [baseURL];
if (
  process.env.REPLIT_DEV_DOMAIN &&
  `https://${process.env.REPLIT_DEV_DOMAIN}` !== baseURL
) {
  trustedOrigins.push(`https://${process.env.REPLIT_DEV_DOMAIN}`);
}
if (process.env.TRUSTED_ORIGINS) {
  for (const o of process.env.TRUSTED_ORIGINS.split(",")) {
    const trimmed = o.trim();
    if (trimmed && !trustedOrigins.includes(trimmed)) trustedOrigins.push(trimmed);
  }
}

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleConfigured = !!(googleClientId && googleClientSecret);

export const auth = betterAuth({
  baseURL,
  basePath: "/api/auth",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: userTable,
      session: sessionTable,
      account: accountTable,
      verification: verificationTable,
    },
  }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
      // Extract token from the reset URL and store it on any pending or approved request.
      // This fires when the admin approves (or re-approves) a request via auth.api.forgetPassword.
      try {
        const token = new URL(url).searchParams.get("token");
        if (token) {
          // Better Auth tokens expire in 1 hour by default.
          const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
          await db
            .update(passwordResetRequestsTable)
            .set({ resetToken: token, status: "approved", approvedAt: new Date(), expiresAt })
            .where(and(
              eq(passwordResetRequestsTable.email, user.email.toLowerCase()),
              // Accept both pending (first approval) and approved (re-approval after expiry).
              sql`status IN ('pending', 'approved')`,
            ));
        }
      } catch (err) {
        console.error("[password-reset] failed to store token", err);
      }
    },
  },
  ...(googleConfigured && {
    socialProviders: {
      google: {
        clientId: googleClientId,
        clientSecret: googleClientSecret,
        // Always show the Google account picker so users are never silently
        // signed in via a cached session — especially on shared machines.
        prompt: "select_account",
      },
    },
  }),
  secret: process.env.SESSION_SECRET ?? "changeme-set-SESSION_SECRET-in-production",
  trustedOrigins,
  advanced: {
    // SECURE_COOKIES env var overrides the auto-detection.
    // Auto-detection uses BETTER_AUTH_URL: if it starts with https:// → true, http:// → false.
    // Self-hosted deployments on plain HTTP (e.g. port 8085 without TLS) MUST have this false,
    // otherwise browsers silently drop every cookie (session, OAuth state) → state_mismatch,
    // silent login failure, and sign-out not working.
    useSecureCookies:
      process.env.SECURE_COOKIES !== undefined
        ? process.env.SECURE_COOKIES === "true"
        : baseURL.startsWith("https://"),
  },
});
