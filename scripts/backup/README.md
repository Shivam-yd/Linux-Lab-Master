# PostgreSQL backup management

These scripts use the PostgreSQL client tools already available in the Replit
runtime. Backups use PostgreSQL's compressed custom format and include a SHA-256
sidecar file. They contain database data, so the backup directory must not be
committed or exposed publicly.

## Create and retain backups

```bash
export BACKUP_DIR=/secure/path/devlabmaster-backups
export RETENTION_COUNT=7
bash scripts/backup/create-backup.sh
```

`DATABASE_URL` is read from the environment and is never printed. The script
creates a timestamped `.dump`, writes its checksum, prevents concurrent runs,
and removes backups older than the configured retention count.

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

Run the create script from a protected host scheduler, not from a web request:

```cron
0 2 * * * cd /path/to/devlabmaster && BACKUP_DIR=/secure/path/devlabmaster-backups /usr/bin/env bash scripts/backup/create-backup.sh >> /var/log/devlabmaster-backup.log 2>&1
```

Use the host's log rotation for the scheduler log. Store backups on durable
storage separate from the application workspace, and periodically perform a
restore drill. A successful backup alone does not prove recoverability.