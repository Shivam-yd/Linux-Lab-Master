# Linux Lab Master

A self-hosted, hands-on DevOps training platform that provides browser-based terminal sandboxes powered by Docker.

## Stack

- **Frontend**: React 19 + Vite, Tailwind CSS 4, Radix UI, TanStack Query, Xterm.js, Framer Motion
- **Backend**: Node.js/Express (ESM), Dockerode, Pino, SSH2
- **Database**: PostgreSQL via Drizzle ORM (Replit's built-in DB)
- **Auth**: Clerk
- **Monorepo**: pnpm workspaces

## Running the project

Two workflows are configured and start automatically:

| Workflow | Command | Port |
|---|---|---|
| `artifacts/api-server: API Server` | `PORT=8080 pnpm --filter @workspace/api-server run dev` | 8080 |
| `artifacts/linux-labs: web` | `PORT=21398 BASE_PATH=/ pnpm --filter @workspace/linux-labs run dev` | 21398 |

The frontend dev server proxies `/api` to the API server on port 8080.

## Environment variables / secrets

| Variable | Where set | Notes |
|---|---|---|
| `CLERK_PUBLISHABLE_KEY` | Replit Secret | Clerk test key from `installer/install.sh` |
| `CLERK_SECRET_KEY` | Replit Secret | Clerk test key from `installer/install.sh` |
| `VITE_CLERK_PUBLISHABLE_KEY` | Shared env var | Same value as above, exposed to Vite |
| `SESSION_SECRET` | Replit Secret | Signs session cookies |
| `DATABASE_URL` | Replit-managed | Auto-provisioned PostgreSQL |

Optional: `GITHUB_TOKEN` raises GitHub API rate limits for lab YAML sync. `LOG_LEVEL` defaults to `info`.

## Project structure

```
artifacts/
  api-server/   — Express backend (entry: src/index.ts)
  linux-labs/   — React frontend (entry: src/main.tsx)
lib/
  db/           — Drizzle ORM schema + migrations
  api-spec/     — Shared API type specs
  api-zod/      — Zod validators
labs/           — YAML lab definitions (synced from GitHub)
installer/      — Docker Compose + Nginx + install scripts
```

## Database

Schema is managed by Drizzle ORM. To push schema changes:
```bash
cd lib/db && npx drizzle-kit push
```

## User preferences

- Keep the existing monorepo structure and stack — do not restructure or migrate.
- Write all code in **ponytail style**: minimum code that works, YAGNI, reuse before building, deletion over addition. See https://github.com/DietrichGebert/ponytail.
