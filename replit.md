# Linux Lab Master (DevLabMaster)

A self-hosted DevOps lab platform providing browser-based terminal sandboxes for hands-on practice with Linux, Docker, Terraform, Jenkins, and Git.

## Stack

- **Frontend**: React 19 + Vite + Tailwind CSS v4 + Radix UI + Wouter + TanStack Query + Xterm.js
- **Backend**: Node.js/Express (ESM) + Dockerode (container management) + ssh2 (terminal sessions)
- **Database**: PostgreSQL via Drizzle ORM (Replit built-in database)
- **Auth**: Better Auth (email/password + optional Google OAuth)
- **Monorepo**: pnpm workspaces

## How to run (dev mode)

Both workflows start automatically:

- **API Server** (`artifacts/api-server`): builds with esbuild then starts on `PORT=8080`
- **Frontend** (`artifacts/linux-labs`): Vite dev server, proxies `/api` to the backend

## Key environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Auto-set by Replit |
| `SESSION_SECRET` | Yes | Set as Replit Secret |
| `BETTER_AUTH_URL` | Yes | Set to `https://<REPLIT_DEV_DOMAIN>` |
| `SECURE_COOKIES` | No | `"true"` on HTTPS (default on Replit) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | No | Enables Google OAuth |
| `ADMIN_EMAILS` | No | Comma-separated admin email list |
| `GITHUB_TOKEN` | No | For syncing lab definitions from GitHub |

## Database migrations

```bash
pnpm --filter @workspace/db run push
```

## Architecture notes

- Lab containers require Docker at runtime — not available in Replit's sandbox. The API will start, but launching lab terminals requires a real Docker daemon.
- Lab definitions live in `labs/` as YAML files; the "Fetch Labs" admin feature syncs them.
- Better Auth trusted origins are configured via `BETTER_AUTH_URL` + `REPLIT_DEV_DOMAIN` auto-detection in `artifacts/api-server/src/lib/auth.ts`.

## User preferences

- Keep code minimal (YAGNI, reuse first, deletion over addition).
