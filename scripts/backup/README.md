# PostgreSQL backup management

These scripts use the PostgreSQL client tools already available in the Replit
runtime. Backups use PostgreSQL's compressed custom format and include a SHA-256
sidecar file. They contain database data, so the backup directory must not be
committed or exposed publicly.

## Create and retain backups

```bash
export BACKUP_DIR=/secure/path/devlabmaster-backups
bash scripts/backup/create-backup.sh
```

`DATABASE_URL` is read from the environment and is never printed. The script
creates a timestamped `.dump`, verifies its checksum and PostgreSQL archive
catalog, prevents concurrent runs, and then removes the previous dump. There
is exactly one completed backup after a successful run. If creation or
verification fails, the previous backup is left untouched.

## Check backups

```bash
bash scripts/backup/status-backups.sh
bash scripts/backup/verify-backup.sh /secure/path/devlabmaster-backups/devlabmaster-20260805T120000Z.dump
```

Verification checks the checksum when present and asks `pg_restore` to read the
archive catalog. It does not modify a database.

## Restore

Restore into a disposable or explicitly selected target database first:

```bash
bash scripts/backup/restore-backup.sh \
  --backup /secure/path/devlabmaster-backups/devlabmaster-20260805T120000Z.dump \
  --target-url "$RECOVERY_DATABASE_URL" \
  --confirm-restore
```

The restore script never falls back to `DATABASE_URL`, requires an explicit
confirmation flag, validates the archive first, and may replace existing
objects in the target. Take a fresh backup of the target before restoring over
it.

## Scheduling

Install the daily schedule once on the host that has access to `DATABASE_URL`:

```bash
PROJECT_DIR=/path/to/devlabmaster \
BACKUP_DIR=/secure/path/devlabmaster-backups \
  bash scripts/backup/install-cron.sh
```

This installs an idempotent cron entry that runs every day at **02:00 in the
host's local timezone**. Re-running the installer replaces only this project's
entry and does not duplicate it.

On Replit, the script is ready to run, but a persistent daily trigger should be
provided by the deployment/host scheduler rather than relying on a development
process staying alive. The Replit setup script deliberately does not install
cron because injected database environment values are not reliably available to
cron jobs. Store the single backup on durable private storage separate from the
application workspace, and periodically perform a restore drill. A successful
backup alone does not prove recoverability.

The Ubuntu self-hosted installer wires this schedule automatically. Because its
PostgreSQL service is inside Kubernetes, it uses
`scripts/backup/create-k8s-backup.sh` and captures the dump from the PostgreSQL
pod before verifying and rotating the host-side backup directory.