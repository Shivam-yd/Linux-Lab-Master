# Linux Lab Master

A self-hosted DevOps training platform with browser-based terminal sandboxes. 78+ labs across Linux, Terraform, Jenkins, Docker, and Git — each backed by a real Docker container with automatic task verification.

## Stack

- **Frontend:** React 19 + Vite + Tailwind CSS v4 (`artifacts/linux-labs`)
- **Backend:** Node.js 20 + Express 5 + TypeScript (`artifacts/api-server`)
- **Database:** PostgreSQL via Drizzle ORM (`lib/db`)
- **Auth:** Better Auth (email/password + optional Google OAuth)
- **Sandboxes:** Docker containers (via Dockerode + SSH)
- **Monorepo:** pnpm workspaces

## How to run

Two workflows run automatically:

| Workflow | Command | Port |
|----------|---------|------|
| API Server | `pnpm --filter @workspace/api-server run dev` | 8080 |
| Web frontend | `pnpm --filter @workspace/linux-labs run dev` | 21398 |

After schema changes: `pnpm --filter @workspace/db run push`

## Environment variables

| Variable | Where set | Notes |
|----------|-----------|-------|
| `DATABASE_URL` | Runtime-managed | Auto-provided by Replit PostgreSQL |
| `SESSION_SECRET` | Replit Secret | Required for auth sessions |
| `BETTER_AUTH_URL` | Shared env | Public base URL of the app |
| `ADMIN_EMAILS` | Shared env | Comma-separated admin email addresses |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Replit Secrets | Optional — enables Google OAuth |
| `GITHUB_TOKEN` | Replit Secret | Optional — increases GitHub API rate limit for lab sync |

## User preferences

- Keep changes minimal (ponytail style: minimum code that works, YAGNI, reuse first).
