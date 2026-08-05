---
name: Database backup safety
description: Operating rules for PostgreSQL backup and restore scripts
---

Backups use PostgreSQL custom-format dumps with checksums and exactly-one retention. The old dump is removed only after the new dump passes checksum and archive-readability checks. Restore must require an explicit target URL and a confirmation flag; it must never default to the active application database.

**Why:** restoring a backup is destructive and an accidental restore against the live database could overwrite user accounts, progress, sessions, and operational records.

**How to apply:** keep backup files on private durable storage outside source control, verify an archive before restore, back up the target first, and perform recovery drills against a disposable target. The Ubuntu/Kubernetes installer must create the first verified dump and install the idempotent 02:00 cron job automatically; refuse schema migration or installation when a required backup cannot be verified.

The admin panel may inspect the server-managed backup, trigger the same verified create flow, and verify the current archive. It must not accept backup paths or live restore targets from the browser.

Backup creation must use a `pg_dump` major version matching the PostgreSQL server. The API image and Ubuntu installer explicitly provide PostgreSQL 16 tools, and the direct backup script checks the connected server major version before dumping.

**Why:** PostgreSQL 15 `pg_dump` refuses to dump a PostgreSQL 16 server, producing a misleading backup failure even though the database itself is healthy.

**How to apply:** keep client and server major versions aligned across Replit, Docker, and Kubernetes paths; fail with the version mismatch before creating or rotating any backup file.