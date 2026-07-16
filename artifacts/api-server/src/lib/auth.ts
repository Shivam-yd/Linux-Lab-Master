import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@workspace/db";
import {
  userTable,
  sessionTable,
  accountTable,
  verificationTable,
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
  emailAndPassword: { enabled: true },
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
    // Don't require Secure cookies when serving over HTTP (e.g. self-hosted with DuckDNS on port
    // 8085 without TLS). Without this, browsers silently drop the session and OAuth state cookies
    // over plain HTTP, causing "state_mismatch" on Google login and lost sessions on email login.
    useSecureCookies: baseURL.startsWith("https://"),
  },
});
