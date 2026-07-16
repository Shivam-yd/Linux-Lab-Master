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
      },
    },
  }),
  secret: process.env.SESSION_SECRET ?? "changeme-set-SESSION_SECRET-in-production",
  // Restrict CSRF origin checks to the known deployment URL.
  // baseURL is computed from BETTER_AUTH_URL → REPLIT_DEV_DOMAIN → localhost.
  trustedOrigins: [baseURL],
});
