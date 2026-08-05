#!/usr/bin/env bash
set -euo pipefail

archive="${1:-}"
[[ -n "$archive" ]] || { echo "usage: $0 BACKUP.dump" >&2; exit 2; }
[[ -f "$archive" ]] || { echo "verify: backup not found: $archive" >&2; exit 1; }
command -v pg_restore >/dev/null || { echo "verify: pg_restore is required" >&2; exit 1; }

if [[ -f "${archive}.sha256" ]]; then
  sha256sum --check "${archive}.sha256"
fi

pg_restore --list "$archive" >/dev/null
echo "Backup is readable and passed its checksum/listing checks: ${archive}"