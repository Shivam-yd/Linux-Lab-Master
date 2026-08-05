#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-backups/postgres}"
RETENTION_COUNT="${RETENTION_COUNT:-7}"
LOCK_FILE="${BACKUP_LOCK_FILE:-${BACKUP_DIR}/.backup.lock}"

die() { echo "backup: $*" >&2; exit 1; }

command -v pg_dump >/dev/null || die "pg_dump is required"
[[ -n "${DATABASE_URL:-}" ]] || die "DATABASE_URL is required"
[[ "$RETENTION_COUNT" =~ ^[1-9][0-9]*$ ]] || die "RETENTION_COUNT must be a positive integer"

mkdir -p "$BACKUP_DIR"
exec 9>"$LOCK_FILE"
flock -n 9 || die "another backup is already running"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
final="${BACKUP_DIR}/devlabmaster-${timestamp}.dump"
temporary="${final}.tmp"
trap 'rm -f "$temporary"' EXIT

echo "Creating PostgreSQL backup: ${final}"
pg_dump \
  --dbname="$DATABASE_URL" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-acl \
  --file="$temporary"
mv "$temporary" "$final"
sha256sum "$final" > "${final}.sha256"

mapfile -t archives < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'devlabmaster-*.dump' -printf '%T@ %p\n' | sort -rn | tail -n +"$((RETENTION_COUNT + 1))" | cut -d' ' -f2-)
for archive in "${archives[@]}"; do
  rm -f -- "$archive" "${archive}.sha256"
done

echo "Backup complete: ${final}"
echo "Retention: kept the ${RETENTION_COUNT} most recent backup(s)"