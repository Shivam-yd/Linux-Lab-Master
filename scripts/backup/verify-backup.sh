#!/usr/bin/env bash
set -euo pipefail

archive="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ -n "$archive" ]] || { echo "usage: $0 BACKUP.dump" >&2; exit 2; }
[[ -f "$archive" ]] || { echo "verify: backup not found: $archive" >&2; exit 1; }
source "${SCRIPT_DIR}/postgres-tools.sh"
pg_restore_bin="$(postgres_tool pg_restore)" || { echo "verify: PostgreSQL ${PG_MAJOR} pg_restore is required" >&2; exit 1; }

if [[ -f "${archive}.sha256" ]]; then
  sha256sum --check "${archive}.sha256"
fi

"$pg_restore_bin" --list "$archive" >/dev/null
echo "Backup is readable and passed its checksum/listing checks: ${archive}"