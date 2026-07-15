import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@workspace/db";
import {
  userTable,
  sessionTable,
  accountTable,
  verificationTable,
} from "@workspace/db/schema";

export const auth = betterAuth({
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
  },
  secret: process.env.SESSION_SECRET ?? "changeme-set-SESSION_SECRET-in-production",
  basePath: "/api/auth",
  // Accept requests from any origin — suitable for self-hosted deployments.
  // Tighten this to specific domains in production if needed.
  trustedOrigins: ["*"],
});
