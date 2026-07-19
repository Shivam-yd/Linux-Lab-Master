---
name: Better Auth trusted origins on Replit
description: BETTER_AUTH_URL goes stale when the repl's dev domain changes; repl.co also needs to be trusted.
---

# Better Auth trusted origins on Replit

## The rule
`BETTER_AUTH_URL` must match the current `REPLIT_DEV_DOMAIN`. When a repl's domain rotates, the env var goes stale and Better Auth rejects every auth request with "Invalid origin".

Replit's webview can send requests from **two** host patterns for the same repl:
- `https://<id>.sisko.replit.dev` (REPLIT_DEV_DOMAIN)
- `https://<id>.sisko.repl.co` (webview proxy — NOT in env vars)

**Why:** Better Auth checks the `Origin` header against `trustedOrigins`. If only `.replit.dev` is trusted, the `.repl.co` webview origin is rejected with a 403.

## How to apply
In `auth.ts`, derive both variants from `REPLIT_DEV_DOMAIN` and push both into `trustedOrigins`:

```ts
if (process.env.REPLIT_DEV_DOMAIN) {
  const replitDev = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const replCo = `https://${process.env.REPLIT_DEV_DOMAIN.replace("replit.dev", "repl.co")}`;
  if (!trustedOrigins.includes(replitDev)) trustedOrigins.push(replitDev);
  if (!trustedOrigins.includes(replCo)) trustedOrigins.push(replCo);
}
```

When the domain rotates, update `BETTER_AUTH_URL` via `setEnvVars` to the new `REPLIT_DEV_DOMAIN` value and restart the API server.
