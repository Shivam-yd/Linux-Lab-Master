# Linux Lab Master

A self-hosted DevOps lab platform providing browser-based terminal sandboxes for practising real Linux, Terraform, Jenkins, Docker, and Git skills. Every lab drops students into a live Docker container with automatic verification.

## Architecture

```
Browser
  └── Replit proxy
        ├── /api/*  →  Node.js/Express API  (artifacts/api-server, port $PORT)
        └── /*      →  React frontend        (artifacts/linux-labs, port $PORT)

PostgreSQL (Replit built-in) — labs, progress, sessions, auth
Docker daemon — spawns per-student sandbox containers on demand
```

## Running the project

Two workflows run automatically:

- **API Server** (`artifacts/api-server`) — `pnpm --filter @workspace/api-server run dev`
- **Linux Labs** (`artifacts/linux-labs`) — `pnpm --filter @workspace/linux-labs run dev`

## Key environment variables

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Replit-managed PostgreSQL (auto-provided) |
| `SESSION_SECRET` | Replit Secret — set |
| `BETTER_AUTH_URL` | App's public base URL (set to Replit dev domain) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional — enables Google OAuth |

## Database

Schema managed by Drizzle Kit. To push schema changes:

```bash
pnpm --filter @workspace/db run push
```

## Monorepo layout

```
artifacts/
  api-server/     ← Express backend (TypeScript, esbuild)
  linux-labs/     ← React frontend (Vite, Tailwind, shadcn/ui)
lib/
  db/             ← Drizzle ORM schema + client
  api-spec/       ← Shared API type definitions
  api-zod/        ← Zod validators
  api-client-react/ ← React Query hooks
labs/
  linux/          ← YAML lab definitions
  terraform/
  jenkins/
  docker/
  git/
```

## User preferences

- Ponytail coding style: minimum code that works, YAGNI, reuse first, deletion over addition.
