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

// Always trust the live Replit dev domain in addition to baseURL.
// Replit rotates REPLIT_DEV_DOMAIN over time, so if BETTER_AUTH_URL is set
// to an older domain the CSRF origin check would reject every browser request.
// Including the current dev domain ensures OAuth keeps working after rotations.
const trustedOrigins = [baseURL];
if (
  process.env.REPLIT_DEV_DOMAIN &&
  `https://${process.env.REPLIT_DEV_DOMAIN}` !== baseURL
) {
  trustedOrigins.push(`https://${process.env.REPLIT_DEV_DOMAIN}`);
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
  // Restrict CSRF origin checks to known deployment origins.
  // trustedOrigins includes both the configured auth URL and the live Replit
  // dev domain so a domain rotation never breaks OAuth.
  trustedOrigins,
});
