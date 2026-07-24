# Linux Lab Master (DevLabMaster)

A self-hosted, browser-based DevOps training platform with 78+ interactive labs across Linux, Docker, Terraform, Jenkins, and Git tracks. Students get real terminal sandboxes with automatic verification.

## Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, TanStack Query, Xterm.js — `artifacts/linux-labs/`
- **API Server**: Node.js/Express (ESM), esbuild — `artifacts/api-server/`
- **Shared libs**: `lib/db/` (Drizzle ORM + PostgreSQL), `lib/api-zod/` (Zod schemas), `lib/api-client-react/` (generated fetch client)
- **Auth**: Better Auth (email/password + Google OAuth)
- **Labs**: YAML definitions in `labs/`, synced from GitHub on startup
- **Certificates**: Track completion certificates with public verification links and native-share/clipboard fallback

## Running on Replit

Both services start automatically via managed workflows:

| Workflow | Command |
|---|---|
| `artifacts/api-server: API Server` | `PORT=8080 pnpm --filter @workspace/api-server run dev` |
| `artifacts/linux-labs: web` | `PORT=21398 BASE_PATH=/ pnpm --filter @workspace/devlabmaster run dev` |

The frontend proxies `/api` requests to the API server at `localhost:8080`.

The imported project requires PostgreSQL for authentication, sessions, progress,
and lab data. Replit setup provisions this through the `postgresql-16` module in
`.replit`; `DATABASE_URL` is supplied automatically. `SESSION_SECRET` must be
available as a Replit Secret, and `BETTER_AUTH_URL` must match the current
`REPLIT_DEV_DOMAIN` when the domain changes.

## Environment Variables

| Variable | Required | Notes |
|---|---|---|
| `SESSION_SECRET` | Yes | Random secret for session signing |
| `BETTER_AUTH_URL` | Yes | Full URL of the API server (e.g. `https://<your-repl>.replit.dev`) |
| `DATABASE_URL` | Auto | Injected by Replit's PostgreSQL database |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth — leave unset to disable |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth — leave unset to disable |
| `ADMIN_EMAILS` | Optional | Comma-separated list of admin email addresses |

## Database

Replit's built-in PostgreSQL. Schema managed by Drizzle ORM.

To push schema changes: `pnpm --filter @workspace/db run push`

## Lab Sandboxes

Terminal labs spin up Docker containers via the Docker daemon. The current
Replit runtime exposes Docker, so live sandboxes are available here; if a future
runtime does not expose the daemon, lab browsing, authentication, and progress
tracking still work but sandbox deployment will be unavailable.

## User Preferences

- Keep code minimal: YAGNI, reuse first, deletion over addition (ponytail style).
