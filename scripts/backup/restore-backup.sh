#!/usr/bin/env bash
set -euo pipefail

archive=""
target="${TARGET_DATABASE_URL:-}"
confirmed=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat >&2 <<'EOF'
Usage:
  restore-backup.sh --backup BACKUP.dump --target-url POSTGRES_URL --confirm-restore

The restore replaces objects in the target database. It never uses DATABASE_URL
implicitly; provide the target explicitly and confirm the destructive operation.
EOF
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backup) archive="${2:-}"; shift 2 ;;
    --target-url) target="${2:-}"; shift 2 ;;
    --confirm-restore) confirmed=true; shift ;;
    *) usage ;;
  esac
done

[[ -n "$archive" && -f "$archive" ]] || { echo "restore: backup file is required" >&2; exit 1; }
[[ -n "$target" ]] || { echo "restore: --target-url or TARGET_DATABASE_URL is required" >&2; exit 1; }
[[ "$confirmed" == true ]] || { echo "restore: add --confirm-restore to permit replacement of target data" >&2; exit 1; }
source "${SCRIPT_DIR}/postgres-tools.sh"
pg_restore_bin="$(postgres_tool pg_restore)" || { echo "restore: PostgreSQL ${PG_MAJOR} pg_restore is required" >&2; exit 1; }

if [[ -f "${archive}.sha256" ]]; then
  sha256sum --check "${archive}.sha256"
fi
"$pg_restore_bin" --list "$archive" >/dev/null

echo "Restoring ${archive} into the explicitly supplied target database."
echo "Existing objects in the target may be replaced."
"$pg_restore_bin" \
  --dbname="$target" \
  --clean \
  --if-exists \
  --exit-on-error \
  --no-owner \
  --no-acl \
  "$archive"
echo "Restore complete."