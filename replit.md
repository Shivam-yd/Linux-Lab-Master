# Linux Labs

A KodeKloud-style platform where students work through real Linux sandbox labs (SSH, users/groups, permissions, cron, log forensics, backup scripting) in a browser terminal and get automated pass/fail grading.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/linux-labs run dev` — run the frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 20, TypeScript 5.9
- API: Express 5 + raw `http.Server`/`ws` WebSocketServer for the terminal
- Sandbox: `dockerode` driving real Docker containers per (student, lab)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Frontend: React + Vite, `@xterm/xterm` terminals, `react-markdown` for lab instructions
- Build: esbuild (ESM bundle)

## Where things live

- `artifacts/api-server/src/lib/labs/` — lab definitions (instructions, tasks, setup/verify bash, per-lab Docker image + terminal→user mapping) and the `registry.ts` index
- `artifacts/api-server/src/lib/docker/manager.ts` — session lifecycle (start/stop/reset/verify) via `dockerode`
- `artifacts/api-server/src/ws/terminal.ts` — raw WebSocket terminal bridge (`/api/ws/terminal?labId=&terminal=`)
- `artifacts/api-server/src/routes/{labs,sessions}.ts` — REST endpoints
- `lib/db/src/schema/lab-sessions.ts` — `students`, `lab_sessions`, `lab_progress` tables
- `lib/api-spec/openapi.yaml` — source of truth for the REST contract (WS route is documented separately, not in OpenAPI)
- `artifacts/linux-labs/` — frontend (catalog + lab workspace pages)

## Architecture decisions

- **No outbound internet inside Docker containers in this environment** — DNS resolution fails, so `apt-get`/`apk install` never works at container runtime or build time. `docker pull` of pre-built images does work. Consequence: every lab uses a pre-built image chosen for what it needs (no custom base image is built).
- Each lab's setup/verify scripts run via `sh -lc` (POSIX), not bash, because some lab images (Alpine) have no bash. Interactive terminals use each lab's declared `shell` (bash where available, sh otherwise).
- Verification runs a bash/sh "verify script" via `docker exec` that prints `CHECK:<taskId>:<PASS|FAIL>:<message>` lines; the API parses these into structured results and looks up the human-readable label from the lab's own task list.
- Sessions are keyed by an anonymous long-lived cookie (`linuxlabs_student_id`), not real accounts — this is a self-serve practice tool, not a multi-tenant product.
- The SSH lab simulates "two servers" as two Linux users (`student1`, `student2`) inside one container with `/etc/hosts` aliases, since spinning up two containers with real networking between them isn't necessary for the lesson.

## Product

- Catalog page lists all labs with difficulty, category, estimated time, and the student's best score/status.
- Lab workspace page: left panel shows markdown instructions + objectives + a "Run Checks" button; right panel has one or more real terminal tabs (xterm.js) connected over WebSocket to a live Docker container exec session.
- Starting a lab provisions a real container and runs a setup script to seed the starting state; resetting destroys and recreates it from scratch.

## User preferences

_None recorded yet._

## Gotchas

- Freshly `useradd -m`-created Linux users have a locked password by default; some sshd/PAM configs reject even pubkey auth for them with a misleading "invalid user" error. Always `chpasswd` a password for any user a lab creates, even for passwordless-SSH labs.
- Real `sudo` is unavailable/shimmed in this Replit environment — lab scripts and the exec-as-root helper use `su -` or direct root exec instead of `sudo`.
- `dockerode` unconditionally `require()`s `ssh2` and `@grpc/*` (for its SSH/session transport) even though this project only uses the local Unix socket. Those packages must be installed as real dependencies and NOT esbuild-externalized in `build.mjs`, or the production bundle crashes at startup with `Cannot find module`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
