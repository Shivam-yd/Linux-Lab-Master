# Linux Lab Master

A self-hosted DevOps lab platform where students practice real commands in browser-based Docker sandboxes. Labs are automatically verified — students type real shell commands, not multiple choice.

## Stack

- **Frontend**: React + Vite + Tailwind CSS (`artifacts/linux-labs`)
- **Backend**: Node.js + Express 5 (`artifacts/api-server`)
- **Auth**: Better Auth with Google OAuth
- **Database**: PostgreSQL via Drizzle ORM (`lib/db`)
- **Lab sandboxes**: Docker containers spawned on demand via Dockerode

## Running on Replit

Two workflows run the app:

| Workflow | Command | Port |
|---|---|---|
| `artifacts/api-server: API Server` | `PORT=8080 pnpm --filter @workspace/api-server run dev` | 8080 |
| `artifacts/linux-labs: web` | `PORT=21398 BASE_PATH=/ pnpm --filter @workspace/linux-labs run dev` | 21398 |

## Required secrets

| Secret | Description |
|---|---|
| `SESSION_SECRET` | Session signing key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |

`BETTER_AUTH_URL` is set as a non-secret env var (the Replit dev domain URL).
`DATABASE_URL` and `PG*` vars are runtime-managed by Replit.

## Schema

Push schema changes to the database:

```
pnpm --filter @workspace/db run push
```

## Lab tracks

Labs are plain YAML files under `labs/`. Tracks: Linux, Terraform, Jenkins, Docker, Git.

## Project structure

```
artifacts/
  api-server/   ← Express API + WebSocket terminal proxy
  linux-labs/   ← React frontend
lib/
  db/           ← Drizzle schema + client
  api-zod/      ← Shared Zod schemas
  api-client-react/ ← React Query API client
labs/           ← YAML lab definitions
```

## User preferences

- Keep code minimal — YAGNI, reuse first, deletion over addition (ponytail style)
