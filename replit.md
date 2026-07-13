# Linux Lab Master

A self-hosted, browser-based DevOps lab platform. Students spin up real Docker sandboxes and complete hands-on exercises across Linux, Terraform, Jenkins, Git, and Docker tracks. Automatic verification checks their work and reports pass/fail per step.

## Architecture

```
Browser → Vite frontend (port 21398, external port 80)
       → Express API server (port 8080)
            └── Docker daemon (spawns lab sandbox containers)
            └── PostgreSQL (lab progress, sessions)
```

- **Frontend**: `artifacts/linux-labs/` — React + Vite + Tailwind + xterm.js
- **API server**: `artifacts/api-server/` — Node.js/Express, built with esbuild
- **Database library**: `lib/db/` — Drizzle ORM schema + migrations
- **Lab definitions**: `labs/<track>/*.yaml` — plain YAML, no code needed to add new labs

## Running the project

Both workflows start automatically. To restart manually:

```
# Frontend (dev server, hot reload)
PORT=21398 BASE_PATH=/ pnpm --filter @workspace/linux-labs run dev

# API server (build then start)
PORT=8080 pnpm --filter @workspace/api-server run dev
```

## Database

Replit's built-in PostgreSQL is used. `DATABASE_URL` is injected automatically at runtime.

To push schema changes after editing `lib/db/src/schema/`:
```
pnpm --filter @workspace/db run push
```

## Environment variables

| Variable | Where set | Notes |
|---|---|---|
| `DATABASE_URL` | Runtime-managed by Replit | Auto-injected; do not set manually |
| `SESSION_SECRET` | Replit Secret | Cookie signing key |
| `LOG_LEVEL` | Optional | Defaults to `info` |
| `PORT` | Workflow config | Set per-service by workflow |

## Lab tracks

Labs live in `labs/<track>/*.yaml`. Each file defines: `id`, `track`, `level`, `category`, `difficulty`, `order`, `instructions`, `setupScript`, `verifyScript`. The API server syncs remote labs from GitHub every hour.

## User preferences
