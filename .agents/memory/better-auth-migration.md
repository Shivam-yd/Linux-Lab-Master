---
name: Better Auth migration
description: Clerk was replaced with Better Auth for self-hosted auth; covers the key decisions made during migration.
---

## What changed
Clerk was fully replaced with Better Auth (email + password). All four Better Auth DB tables (user, session, account, verification) are defined in `lib/db/src/schema/auth.ts` and exported from `lib/db/src/schema/index.ts`.

## Key decisions

**Express 5 wildcard**: `app.all("/api/auth/*", handler)` throws a PathError in Express 5 (bare `*` not allowed). Use `app.use("/api/auth", handler)` instead.

**Why:** Express 5 upgraded path-to-regexp and requires named wildcards. `app.use` is the correct mounting pattern for Better Auth.

**OpenTelemetry peer dep**: `better-auth` imports `@opentelemetry/semantic-conventions` at runtime. The esbuild config in `build.mjs` externalizes `@opentelemetry/*`, so the package must be installed as a direct dep of `@workspace/api-server`. Without it the server crashes on startup.

**BETTER_AUTH_URL**: Must be set (to `http://localhost:8080` in dev) or Better Auth warns and redirects may break. Set as a shared env var.

**Social sign-in must use POST via client**: `GET /api/auth/sign-in/social` returns 404. Always use `signIn.social({ provider, callbackURL })` from the Better Auth React client — it sends a POST and handles the redirect. Using `window.location.href` to navigate to the URL is a GET and will always 404.

**WS auth**: Better Auth's `auth.api.getSession({ headers: fromNodeHeaders(req.headers) })` works for raw HTTP upgrade requests. The session cookie (`better-auth.session_token`) is included in the upgrade request headers automatically.

**Guest mode preserved**: The existing `_sid` signed cookie guest fallback in `middleware/auth.ts` is unchanged. If no Better Auth session is found, the cookie path runs as before.

**How to apply:** If Better Auth is upgraded, check that `@opentelemetry/semantic-conventions` version still satisfies the peer dep. Also verify the `app.use("/api/auth", ...)` pattern still works with the installed Express version.
