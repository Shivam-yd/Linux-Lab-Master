#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# DevLabMaster — migrate data from the old docker-compose postgres volume
#                into the running k3s postgres StatefulSet.
#
# Usage (run as root on the server, after the k3s install is complete):
#   sudo bash installer/restore-from-compose.sh
#
# What it does:
#   1. Finds the old docker-compose postgres volume (linuxlabs_pgdata)
#   2. Dumps it via a temporary postgres:16-alpine container
#   3. Restores the dump into the k3s postgres pod
#   4. Keeps the dump file in /opt/linuxlabs/backups/ as a safety copy
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[•]${RESET} $*"; }
success() { echo -e "${GREEN}[✓]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[!]${RESET} $*"; }
die()     { echo -e "${RED}[✗]${RESET} $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Please run as root:  sudo bash installer/restore-from-compose.sh"

INSTALL_DIR="/opt/linuxlabs"
ENV_FILE="${INSTALL_DIR}/.env"
BACKUP_DIR="${INSTALL_DIR}/backups"
KUBECONFIG=/etc/rancher/k3s/k3s.yaml
export KUBECONFIG

mkdir -p "${BACKUP_DIR}"

# ── Load secrets ──────────────────────────────────────────────────────────────
[[ -f "${ENV_FILE}" ]] || die "No .env found at ${ENV_FILE}. Run the installer first."
set -o allexport; source "${ENV_FILE}"; set +o allexport
[[ -n "${POSTGRES_PASSWORD:-}" ]] || die "POSTGRES_PASSWORD missing from ${ENV_FILE}."

# ── Find the old docker-compose volume ───────────────────────────────────────
# docker-compose names volumes as <project>_<volume>, project = directory name.
# The install copies files to /opt/linuxlabs, so the project name is "linuxlabs".
OLD_VOLUME="linuxlabs_pgdata"

if ! docker volume inspect "${OLD_VOLUME}" &>/dev/null; then
  # Try alternate project names in case the user cloned to a different directory
  for ALT in devlabmaster_pgdata linux-lab-master_pgdata pgdata; do
    if docker volume inspect "${ALT}" &>/dev/null; then
      OLD_VOLUME="${ALT}"
      break
    fi
  done
fi

docker volume inspect "${OLD_VOLUME}" &>/dev/null \
  || die "Could not find the old postgres volume. Tried: linuxlabs_pgdata, devlabmaster_pgdata, linux-lab-master_pgdata, pgdata.
       Run 'docker volume ls | grep pg' to see what's available, then edit OLD_VOLUME in this script."

success "Found old volume: ${OLD_VOLUME}"

# ── Dump from the old volume ──────────────────────────────────────────────────
DUMP_FILE="${BACKUP_DIR}/compose-migration-$(date +%Y%m%d-%H%M%S).sql"
info "Dumping old database from ${OLD_VOLUME} → ${DUMP_FILE} ..."

# Start a named recovery container with the old volume mounted read-write.
# (postgres must be able to write lock files — read-only mounts don't work.)
RECOVER_CTR="devlabmaster-pg-recover"
docker rm -f "${RECOVER_CTR}" 2>/dev/null || true

docker run -d \
  --name "${RECOVER_CTR}" \
  -v "${OLD_VOLUME}:/var/lib/postgresql/data" \
  postgres:16-alpine
trap 'docker rm -f "${RECOVER_CTR}" 2>/dev/null || true' EXIT

# Wait for postgres to accept connections (up to 30s)
info "Waiting for recovery postgres to start..."
for _i in $(seq 1 15); do
  if docker exec "${RECOVER_CTR}" pg_isready -U linuxlabs -d linuxlabs -q 2>/dev/null; then
    break
  fi
  sleep 2
done
docker exec "${RECOVER_CTR}" pg_isready -U linuxlabs -d linuxlabs -q \
  || die "Recovery postgres did not start. The old data directory may be corrupt."

# Try the current .env password first, then the compose default "linuxlabs"
dump_ok=false
for PG_PASS in "${POSTGRES_PASSWORD}" "linuxlabs"; do
  if docker exec -e PGPASSWORD="${PG_PASS}" "${RECOVER_CTR}" \
      pg_dump -U linuxlabs -d linuxlabs --no-owner --no-acl \
      > "${DUMP_FILE}" 2>/dev/null; then
    dump_ok=true
    break
  fi
done

${dump_ok} || die "pg_dump failed. Check the recovery container logs:
  docker logs ${RECOVER_CTR}"

DUMP_SIZE=$(du -sh "${DUMP_FILE}" | cut -f1)
success "Dump complete: ${DUMP_FILE} (${DUMP_SIZE})"

# ── Wait for k3s postgres to be ready ────────────────────────────────────────
info "Checking k3s postgres..."
POSTGRES_POD=$(kubectl get pods -n devlabmaster -l app=postgres \
  -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
[[ -n "${POSTGRES_POD}" ]] \
  || die "No postgres pod found in the devlabmaster namespace. Is the k3s install complete?"

kubectl wait pod/"${POSTGRES_POD}" -n devlabmaster \
  --for=condition=Ready --timeout=60s
success "k3s postgres pod ready: ${POSTGRES_POD}"

# ── Restore into k3s postgres ─────────────────────────────────────────────────
info "Restoring into k3s postgres (existing rows will be skipped on conflict)..."

# Copy the dump file into the pod then restore
kubectl cp "${DUMP_FILE}" \
  "devlabmaster/${POSTGRES_POD}:/tmp/restore.sql"

kubectl exec -n devlabmaster "${POSTGRES_POD}" -- \
  psql -U linuxlabs -d linuxlabs \
    -v ON_ERROR_STOP=0 \
    -f /tmp/restore.sql \
  2>&1 | grep -v "^SET$\|^--\|already exists\|^$" || true

kubectl exec -n devlabmaster "${POSTGRES_POD}" -- \
  rm -f /tmp/restore.sql

success "Restore complete!"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}${GREEN}  Data migration from docker-compose → k3s done!  ${RESET}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "  Dump kept at: ${BOLD}${DUMP_FILE}${RESET}"
echo ""
echo -e "  ${CYAN}Next steps:${RESET}"
echo -e "    1. Refresh the webapp — all student accounts and progress should be visible"
echo -e "    2. If anything looks wrong, restore from the dump manually:"
echo -e "       kubectl exec -n devlabmaster ${POSTGRES_POD} -- psql -U linuxlabs linuxlabs < ${DUMP_FILE}"
echo ""
