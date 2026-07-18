# Linux Lab Master

A self-hosted DevOps lab platform with browser-based terminal sandboxes for practising real DevOps skills.

## Stack

- **Frontend**: React + Vite + Tailwind (artifacts/linux-labs) — served on `/`
- **API**: Node.js + Express + Better Auth (artifacts/api-server) — served on `/api`
- **Database**: PostgreSQL (Replit managed) via Drizzle ORM
- **Monorepo**: pnpm workspaces

## Running locally (Replit)

Both workflows are pre-configured and start automatically:

| Workflow | Command |
|----------|---------|
| `artifacts/api-server: API Server` | `PORT=8080 pnpm --filter @workspace/api-server run dev` |
| `artifacts/linux-labs: web` | `PORT=21398 BASE_PATH=/ pnpm --filter @workspace/linux-labs run dev` |

## Environment Variables

| Key | Required | Notes |
|-----|----------|-------|
| `SESSION_SECRET` | ✅ | Set as Replit Secret |
| `BETTER_AUTH_URL` | ✅ | Set to the Replit dev domain |
| `ADMIN_EMAILS` | ✅ | Comma-separated admin email addresses |
| `GOOGLE_CLIENT_ID` | Optional | For Google OAuth login |
| `GOOGLE_CLIENT_SECRET` | Optional | For Google OAuth login |
| `DATABASE_URL` | Auto | Managed by Replit |

## Database

Schema is managed with Drizzle ORM. To push schema changes:

```bash
cd lib/db && pnpm run push
```

## Key Packages

- `lib/db` — Drizzle schema + client
- `lib/api-zod` — Zod schemas for API request/response validation
- `lib/api-client-react` — React Query hooks wrapping the API
- `artifacts/api-server` — Express API (auth, labs, progress, github-sync)
- `artifacts/linux-labs` — React frontend

## Lab Content

Labs are YAML files synced from GitHub automatically on startup and every hour. The sync pulls from the connected GitHub repo and stores labs in `remote_labs` table.

## Note on Docker Sandboxes

The Docker-based terminal sandboxes require a Docker daemon and do not work on Replit. The frontend and API run fully; sandbox provisioning will fail gracefully.

## User Preferences

- Keep code minimal — minimum code that works, YAGNI, reuse first, deletion over addition (ponytail style).
