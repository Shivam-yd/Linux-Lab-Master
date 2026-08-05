#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-${PROJECT_DIR}/backups/postgres}"
MARKER="# devlabmaster-postgres-backup"
SCRIPT="${BACKUP_SCRIPT:-${PROJECT_DIR}/scripts/backup/create-backup.sh}"

command -v crontab >/dev/null || { echo "cron: crontab is required" >&2; exit 1; }
[[ -x "$SCRIPT" ]] || { echo "cron: backup script is not executable: $SCRIPT" >&2; exit 1; }
[[ "$BACKUP_DIR" = /* ]] || { echo "cron: BACKUP_DIR must be an absolute path" >&2; exit 1; }

entry="0 2 * * * cd $(printf '%q' "$PROJECT_DIR") && BACKUP_DIR=$(printf '%q' "$BACKUP_DIR") $(printf '%q' "$SCRIPT") ${MARKER}"
current="$(crontab -l 2>/dev/null || true)"
filtered="$(printf '%s\n' "$current" | grep -vF "$MARKER" || true)"
{
  [[ -z "$filtered" ]] || printf '%s\n' "$filtered"
  printf '%s\n' "$entry"
} | crontab -

echo "Installed one daily PostgreSQL backup at 02:00 in the host's local timezone."
echo "Backup directory: $BACKUP_DIR"