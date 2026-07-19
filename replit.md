# DevLabMaster (Linux Lab Master)

A self-hosted DevOps training platform with browser-based terminal sandboxes. Students practice real Linux, Terraform, Jenkins, Docker, and Git commands in live containers with automatic verification.

## Stack

- **Frontend:** React + Vite + Tailwind CSS (`artifacts/linux-labs`, package `@workspace/devlabmaster`)
- **Backend:** Express + Better Auth (`artifacts/api-server`, package `@workspace/api-server`)
- **Database:** PostgreSQL via Drizzle ORM (`lib/db`)
- **Labs:** YAML files in `labs/` — synced to the database on API startup

## How to run (dev mode)

Both workflows start automatically:

| Workflow | Command |
|---|---|
| `artifacts/api-server: API Server` | `PORT=8080 pnpm --filter @workspace/api-server run dev` |
| `artifacts/linux-labs: web` | `PORT=21398 pnpm --filter @workspace/devlabmaster run dev` |

The API server builds its bundle with esbuild (`build.mjs`) then starts on port 8080. The frontend Vite dev server runs on port 21398.

## Environment variables

| Variable | Notes |
|---|---|
| `SESSION_SECRET` | Secret — required for cookie signing |
| `BETTER_AUTH_URL` | Base URL for Better Auth (set to the Replit dev domain) |
| `ADMIN_EMAILS` | Comma-separated list of admin email addresses |
| `DATABASE_URL` | Runtime-managed by Replit |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional — enables Google OAuth |

## Schema

Run `pnpm --filter @workspace/db run push` to push schema changes to the database.

## Known limitations on Replit

The Docker sandbox engine (which provisions live containers for students) requires a local Docker daemon and **does not work inside the Replit environment**. The rest of the platform — auth, lab browsing, progress tracking, the UI — works normally.

## User preferences

- Ponytail coding style: minimum code that works, YAGNI, reuse first, deletion over addition.
