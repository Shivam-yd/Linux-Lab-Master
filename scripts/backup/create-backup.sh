#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-backups/postgres}"
LOCK_FILE="${BACKUP_LOCK_FILE:-${BACKUP_DIR}/.backup.lock}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

die() { echo "backup: $*" >&2; exit 1; }

source "${SCRIPT_DIR}/postgres-tools.sh"
pg_dump_bin="$(postgres_tool pg_dump)" || die "PostgreSQL ${PG_MAJOR} pg_dump is required"
pg_restore_bin="$(postgres_tool pg_restore)" || die "PostgreSQL ${PG_MAJOR} pg_restore is required"
psql_bin="$(postgres_tool psql)" || die "PostgreSQL ${PG_MAJOR} psql is required"
[[ -n "${DATABASE_URL:-}" ]] || die "DATABASE_URL is required"
check_postgres_server_major "$DATABASE_URL" "$psql_bin" "$pg_dump_bin" ||
  die "PostgreSQL client/server major versions must match"

mkdir -p "$BACKUP_DIR"
exec 9>"$LOCK_FILE"
flock -n 9 || die "another backup is already running"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
final="${BACKUP_DIR}/devlabmaster-${timestamp}.dump"
temporary="${final}.tmp"
temporary_checksum="${temporary}.sha256"
trap 'rm -f "$temporary" "$temporary_checksum"' EXIT

echo "Creating PostgreSQL backup: ${final}"
"$pg_dump_bin" \
  --dbname="$DATABASE_URL" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-acl \
  --file="$temporary"

# Validate the new archive before publishing it or removing the current one.
sha256sum "$temporary" > "$temporary_checksum"
sha256sum --check "$temporary_checksum" >/dev/null
"$pg_restore_bin" --list "$temporary" >/dev/null

mv "$temporary" "$final"
sha256sum "$final" > "${final}.sha256"
sha256sum --check "${final}.sha256" >/dev/null

# Keep exactly one completed backup. This happens only after the replacement
# has been fully written and verified.
while IFS= read -r archive; do
  [[ "$archive" == "$final" ]] || rm -f -- "$archive" "${archive}.sha256"
done < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'devlabmaster-*.dump' -print)
rm -f "$BACKUP_DIR"/linuxlabs-*.sql "$BACKUP_DIR"/compose-migration-*.sql

echo "Backup complete: ${final}"
echo "Retention: kept exactly one verified backup"