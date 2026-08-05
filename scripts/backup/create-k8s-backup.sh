#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/linuxlabs}"
BACKUP_DIR="${BACKUP_DIR:-${INSTALL_DIR}/backups}"
NAMESPACE="${BACKUP_NAMESPACE:-devlabmaster}"
LOCK_FILE="${BACKUP_LOCK_FILE:-${BACKUP_DIR}/.backup.lock}"

die() { echo "backup: $*" >&2; exit 1; }

command -v kubectl >/dev/null || die "kubectl is required"
command -v pg_restore >/dev/null || die "pg_restore is required"
[[ -f "${INSTALL_DIR}/.env" ]] || die "missing ${INSTALL_DIR}/.env"
set -o allexport
source "${INSTALL_DIR}/.env"
set +o allexport
[[ -n "${POSTGRES_PASSWORD:-}" ]] || die "POSTGRES_PASSWORD is required"

mkdir -p "$BACKUP_DIR"
exec 9>"$LOCK_FILE"
flock -n 9 || die "another backup is already running"

pod="$(kubectl get pods -n "$NAMESPACE" -l app=postgres -o jsonpath='{.items[0].metadata.name}')"
[[ -n "$pod" ]] || die "PostgreSQL pod is not available"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
final="${BACKUP_DIR}/devlabmaster-${timestamp}.dump"
temporary="${final}.tmp"
remote="/tmp/devlabmaster-${timestamp}.dump"
trap 'rm -f "$temporary"; kubectl exec -n "$NAMESPACE" "$pod" -- rm -f "$remote" >/dev/null 2>&1 || true' EXIT

echo "Creating PostgreSQL backup from pod ${pod}: ${final}"
kubectl exec -n "$NAMESPACE" "$pod" -- env \
  PGPASSWORD="$POSTGRES_PASSWORD" \
  BACKUP_FILE="$remote" \
  sh -ceu '
    pg_dump \
      --host=127.0.0.1 \
      --username=linuxlabs \
      --dbname=linuxlabs \
      --format=custom \
      --compress=9 \
      --no-owner \
      --no-acl \
      --file="$BACKUP_FILE"
    pg_restore --list "$BACKUP_FILE" >/dev/null
    sha256sum "$BACKUP_FILE" > "$BACKUP_FILE.sha256"
    sha256sum --check "$BACKUP_FILE.sha256" >/dev/null
  '

kubectl exec -n "$NAMESPACE" "$pod" -- cat "$remote" > "$temporary"
pg_restore --list "$temporary" >/dev/null
mv "$temporary" "$final"
sha256sum "$final" > "${final}.sha256"
sha256sum --check "${final}.sha256" >/dev/null

# Delete prior completed backups only after the new file has been transferred
# and verified locally.
while IFS= read -r archive; do
  [[ "$archive" == "$final" ]] || rm -f -- "$archive" "${archive}.sha256"
done < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'devlabmaster-*.dump' -print)
rm -f "${BACKUP_DIR}"/linuxlabs-*.sql "${BACKUP_DIR}"/compose-migration-*.sql

echo "Backup complete: ${final}"
echo "Retention: kept exactly one verified backup"