# Linux Lab Master

A self-hosted DevOps training platform providing browser-based terminal sandboxes with automated lab verification and a progressive curriculum covering Linux, Docker, Git, Terraform, and Jenkins.

## Architecture

This is a pnpm monorepo with the following packages:

- **`artifacts/linux-labs`** — React 19 + Vite frontend (Tailwind CSS v4, Radix UI / Shadcn, TanStack Query, Wouter)
- **`artifacts/api-server`** — Express + TypeScript API server with WebSocket terminal support (Dockerode, ssh2)
- **`lib/db`** — Drizzle ORM schema + PostgreSQL client (shared library)
- **`lib/api-spec`** — OpenAPI spec + generated Zod schemas and React Query hooks (Orval)

## How to Run

Both services start automatically via their configured workflows:

| Workflow | Command | URL |
|---|---|---|
| `artifacts/linux-labs: web` | `PORT=21398 BASE_PATH=/ pnpm --filter @workspace/linux-labs run dev` | `/` (preview) |
| `artifacts/api-server: API Server` | `PORT=8080 pnpm --filter @workspace/api-server run dev` | `/api` |

## Environment Variables

| Variable | Source | Notes |
|---|---|---|
| `DATABASE_URL` | Replit (runtime-managed) | PostgreSQL connection string |
| `SESSION_SECRET` | Replit Secret | Express session signing key |
| `CLERK_PUBLISHABLE_KEY` | Replit Secret (optional) | Clerk auth — only needed for production |
| `CLERK_SECRET_KEY` | Replit Secret (optional) | Clerk auth proxy — only active in production |

## Database

Uses Replit's built-in PostgreSQL. Schema is managed with Drizzle Kit.

To push schema changes:
```
cd lib/db && DATABASE_URL="$DATABASE_URL" pnpm run push
```

Tables: `students`, `lab_sessions`, `lab_progress`, `remote_labs`, `lab_sync_log`

## Key Notes

- **Docker sandboxes** require a Docker host. The Docker socket path and connectivity depend on the environment. On Replit, sandbox _deployment_ won't work without an external Docker host, but the UI and API run fine.
- The API server warms Docker images on startup and polls GitHub for remote lab definitions every 60 minutes.
- Clerk proxy middleware is a no-op in development (`NODE_ENV !== 'production'`).

## User Preferences

- Keep project structure as-is (pnpm monorepo with artifacts/ and lib/ directories).
