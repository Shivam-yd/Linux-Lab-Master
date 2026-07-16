# Linux Labs

A hands-on Linux/DevOps learning platform that provides sandboxed lab environments for tracks like Linux, Docker, Jenkins, and Terraform.

## Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS v4 + Shadcn UI (`artifacts/linux-labs`)
- **Backend**: Node.js + Express + WebSockets for terminal emulation (`artifacts/api-server`)
- **Database**: PostgreSQL via Drizzle ORM (`lib/db`)
- **Auth**: Better Auth with email/password (Google OAuth optional)
- **Infrastructure**: Docker — the API spawns containers as lab sandboxes
- **Lab content**: YAML definitions in `labs/`

## Running on Replit

Both services start automatically via the configured workflows:

| Service | Workflow | Port |
|---------|----------|------|
| API server | `artifacts/api-server: API Server` | 8080 |
| Frontend | `artifacts/linux-labs: web` | 21398 (preview root) |

The frontend is served at `/` in the preview pane.

## Environment Variables

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Auto-provided by Replit's built-in PostgreSQL |
| `SESSION_SECRET` | Yes | Set as a Replit Secret |
| `BETTER_AUTH_URL` | Yes | Set in `.replit` userenv — points to this repl's dev domain |
| `GOOGLE_CLIENT_ID` | No | Enables Google OAuth login if both Google vars are set |
| `GOOGLE_CLIENT_SECRET` | No | Enables Google OAuth login if both Google vars are set |
| `GITHUB_TOKEN` | No | Enables GitHub sync for lab content |

## Database

Schema is managed with Drizzle ORM. To push schema changes to the database:

```bash
pnpm --filter @workspace/db run push
```

## Lab Content

Labs are defined as YAML files in `labs/`. They can be synced from a GitHub repository if `GITHUB_TOKEN` is set.

## User Preferences

- Keep the existing monorepo structure and stack — do not restructure or migrate.
