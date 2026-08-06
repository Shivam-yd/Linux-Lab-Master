# Linux Lab Master (DevLabMaster)

A self-hosted, browser-based DevOps training platform with 85 interactive labs across Linux, Docker, Terraform, Jenkins, Git, Kubernetes, and Ansible tracks. Students get real terminal sandboxes with automatic verification.

## Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, TanStack Query, Xterm.js — `artifacts/linux-labs/`
- **API Server**: Node.js/Express (ESM), esbuild — `artifacts/api-server/`
- **Shared libs**: `lib/db/` (Drizzle ORM + PostgreSQL), `lib/api-zod/` (Zod schemas), `lib/api-client-react/` (generated fetch client)
- **Auth**: Better Auth (email/password; social sign-in is not enabled in the current server build)
- **Labs**: 74 YAML definitions in `labs/`, plus 11 built-in Linux labs; synced from GitHub on startup
- **Certificates**: Track completion certificates with public verification links and native-share/clipboard fallback

## Running on Replit

Both services start automatically via managed workflows:

| Workflow | Command |
|---|---|
| `artifacts/api-server: API Server` | `PORT=8080 pnpm --filter @workspace/api-server run dev` |
| `artifacts/linux-labs: web` | `PORT=21398 BASE_PATH=/ pnpm --filter @workspace/devlabmaster run dev` |

The frontend proxies `/api` requests to the API server at `localhost:8080`.

For a fresh or imported Replit workspace, run:

```bash
bash scripts/setup-replit.sh
```

The script installs the frozen lockfile dependencies, checks PostgreSQL, and
pushes the Drizzle schema. It does not install cron or manage durable backups;
use the deployment/host scheduler for recurring backups.

The imported project requires PostgreSQL for authentication, sessions, progress,
and lab data. Replit setup provisions this through the `postgresql-16` module in
`.replit`; `DATABASE_URL` is supplied automatically. `SESSION_SECRET` must be
available as a Replit Secret, and `BETTER_AUTH_URL` must match the current
`REPLIT_DEV_DOMAIN` when the domain changes.

## Environment Variables

| Variable | Required | Notes |
|---|---|---|
| `SESSION_SECRET` | Yes | Random secret for session signing |
| `BETTER_AUTH_URL` | Yes | Full URL of the API server (e.g. `https://<your-repl>.replit.dev`) |
| `DATABASE_URL` | Auto | Injected by Replit's PostgreSQL database |
| `GOOGLE_CLIENT_ID` | Reserved | Social sign-in configuration; not enabled in the current server build |
| `GOOGLE_CLIENT_SECRET` | Reserved | Social sign-in configuration; not enabled in the current server build |
| `ADMIN_EMAILS` | Optional | Comma-separated list of admin email addresses |
| `MAX_ACTIVE_SESSIONS_PER_STUDENT` | Optional | Per-user concurrent sandbox limit; defaults to 2 |

## Database

Replit's built-in PostgreSQL. Schema managed by Drizzle ORM.

To push schema changes: `pnpm --filter @workspace/db run push`

PostgreSQL backup and restore operators' scripts live in `scripts/backup/`.
The policy retains exactly one verified backup: the daily job runs at 02:00 in
the host's local timezone, and deletes the previous dump only after the new
dump passes checksum and archive-readability checks. Restore always requires an
explicit target URL and `--confirm-restore`. Keep backup files on durable,
private storage outside the repository.

## Lab Sandboxes

Terminal labs spin up Docker containers via the Docker daemon. The current
Replit runtime exposes Docker, so live sandboxes are available here; if a future
runtime does not expose the daemon, lab browsing, authentication, and progress
tracking still work but sandbox deployment will be unavailable. The API warms
the images referenced by the lab registry at startup; image-pull failures are
reported per lab instead of stopping the API.

## User Preferences

- Keep code minimal: YAGNI, reuse first, deletion over addition (ponytail style).
