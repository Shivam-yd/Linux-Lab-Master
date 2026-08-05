#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-backups/postgres}"

if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "No backup directory exists yet: ${BACKUP_DIR}"
  exit 0
fi

mapfile -t archives < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'devlabmaster-*.dump' -printf '%T@ %p\n' | sort -rn | cut -d' ' -f2-)
if [[ "${#archives[@]}" -eq 0 ]]; then
  echo "No PostgreSQL backups found in ${BACKUP_DIR}"
  exit 0
fi

printf '%-58s %12s %s\n' "BACKUP" "SIZE" "CHECKSUM"
for archive in "${archives[@]}"; do
  checksum="missing"
  [[ -f "${archive}.sha256" ]] && checksum="present"
  printf '%-58s %12s %s\n' "$archive" "$(du -h "$archive" | cut -f1)" "$checksum"
done