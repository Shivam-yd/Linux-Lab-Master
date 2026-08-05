#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# DevLabMaster — Ubuntu installer (k3s edition)
#
# Usage (from the project root, first-time setup only):
#   sudo bash installer/install.sh
#
# What it does:
#   1. Installs Docker Engine (still needed: image builds + lab sandboxes)
#   2. Installs k3s (single-node Kubernetes)
#   3. Starts a local image registry on localhost:5000
#   4. Copies the project to /opt/linuxlabs
#   5. Generates random secrets and configures Better Auth
#   6. Creates the devlabmaster k8s namespace + secret
#   7. Builds Docker images and deploys them
#   8. Pre-pulls lab container images so sandbox startup is instant
#   9. Installs a verified, single-retained daily database backup at 02:00
#
# Subsequent deploys are handled by GitHub Actions — re-running this script is
# only needed after wiping the server.
#
# Supported: Ubuntu 20.04 LTS, 22.04 LTS, 24.04 LTS
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[•]${RESET} $*"; }
success() { echo -e "${GREEN}[✓]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[!]${RESET} $*"; }
die()     { echo -e "${RED}[✗]${RESET} $*" >&2; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}── $* ──${RESET}"; }

INSTALL_DIR="/opt/linuxlabs"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
JENKINS_GUI_IMAGE="jenkins/jenkins:lts-jdk17"
JENKINS_GUI_LAB="${PROJECT_ROOT}/labs/jenkins/l1-06-gui-first-job.yaml"

# ── Preflight ─────────────────────────────────────────────────────────────────
header "Preflight"

[[ $EUID -eq 0 ]] || die "Please run as root:  sudo bash installer/install.sh"

[[ -f "${PROJECT_ROOT}/Dockerfile" ]] || \
  die "Run this script from the project root."

if [[ ! -f "${JENKINS_GUI_LAB}" ]]; then
  die "Jenkins GUI lab is missing: ${JENKINS_GUI_LAB}"
fi
grep -Eq '^id: "jenkins-gui-first-job"$' "${JENKINS_GUI_LAB}" || \
  die "Jenkins GUI lab has an unexpected ID."
grep -Fq "image: \"${JENKINS_GUI_IMAGE}\"" "${JENKINS_GUI_LAB}" || \
  die "Jenkins GUI lab must use ${JENKINS_GUI_IMAGE}."
grep -Eq '^useImageCmd: true$' "${JENKINS_GUI_LAB}" || \
  die "Jenkins GUI lab must use Jenkins' image startup command."
grep -Eq '^uiPath: "/jenkins/"$' "${JENKINS_GUI_LAB}" || \
  die "Jenkins GUI lab must expose its UI at /jenkins/."
grep -Eq '^[[:space:]]+- 8080$' "${JENKINS_GUI_LAB}" || \
  die "Jenkins GUI lab must expose port 8080."

if [[ -f /etc/os-release ]]; then
  source /etc/os-release
  [[ "${ID:-}" == "ubuntu" ]] || warn "Targets Ubuntu; continuing on ${PRETTY_NAME:-unknown}."
fi

success "Preflight passed"

# ── Step 1: Docker ────────────────────────────────────────────────────────────
header "Step 1/7 — Docker"

install_docker() {
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
                          docker-buildx-plugin docker-compose-plugin
}

install_postgres_client() {
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    | gpg --dearmor -o /etc/apt/keyrings/postgresql.gpg
  source /etc/os-release
  echo "deb [signed-by=/etc/apt/keyrings/postgresql.gpg] \
    https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  apt-get update -qq
  apt-get install -y -qq postgresql-client-16 cron
}

if command -v docker &>/dev/null && docker info &>/dev/null; then
  success "Docker already running ($(docker --version))"
else
  install_docker
  systemctl enable --now docker
  success "Docker installed"
fi

if ! command -v pg_dump &>/dev/null || ! command -v pg_restore &>/dev/null ||
   ! command -v crontab &>/dev/null || ! pg_dump --version | grep -qE 'PostgreSQL 16(\.|$)'; then
  info "Installing PostgreSQL 16 client and cron tools for verified backups..."
  install_postgres_client
fi
systemctl enable --now cron
success "PostgreSQL backup tools available"

# envsubst is used by the GitHub Actions deploy to template k8s manifests
if ! command -v envsubst &>/dev/null; then
  apt-get install -y -qq gettext-base
fi
success "envsubst available"

# rsync for project copy
if ! command -v rsync &>/dev/null; then
  apt-get install -y -qq rsync
fi

# ── Step 2: k3s ───────────────────────────────────────────────────────────────
header "Step 2/7 — k3s"

# Tell k3s to trust the local registry and write kubeconfig world-readable
mkdir -p /etc/rancher/k3s
cat > /etc/rancher/k3s/registries.yaml <<'EOF'
mirrors:
  "localhost:5000":
    endpoint:
      - "http://localhost:5000"
EOF

# write-kubeconfig-mode 644 lets non-root users (e.g. github-runner) run kubectl
# without needing sudo or a copied kubeconfig.
cat > /etc/rancher/k3s/config.yaml <<'EOF'
write-kubeconfig-mode: "0644"
EOF

if command -v k3s &>/dev/null; then
  success "k3s already installed ($(k3s --version | head -1))"
else
  info "Installing k3s..."
  curl -sfL https://get.k3s.io | sh -
  success "k3s installed"
fi

systemctl enable k3s
# Restart so any registries.yaml change is picked up (restart is a no-op if not yet running)
systemctl restart k3s
# Wait until the k3s API server is actually accepting requests
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
info "Waiting for k3s API server..."
for _i in $(seq 1 30); do
  kubectl get nodes &>/dev/null && break
  sleep 3
done
kubectl get nodes &>/dev/null || die "k3s API server did not become ready in 90 s"
success "k3s running"

# Give the GitHub Actions runner (if present) kubectl + docker access
if id github-runner &>/dev/null; then
  install -D -m 600 /etc/rancher/k3s/k3s.yaml /home/github-runner/.kube/config
  chown github-runner:github-runner /home/github-runner/.kube/config

  # Add to docker group so direct docker commands work after a re-login.
  # CI uses "sudo docker" / "sudo kubectl" which works immediately via the
  # runner's existing sudo access — no extra sudoers rules needed.
  usermod -aG docker github-runner
  success "github-runner added to docker group"
fi

# ── Step 3: Local registry ────────────────────────────────────────────────────
header "Step 3/7 — Local registry"

if docker ps --format '{{.Names}}' | grep -q '^registry$'; then
  success "Registry already running"
else
  docker run -d --restart=always -p 127.0.0.1:5000:5000 --name registry registry:2
  success "Registry started on localhost:5000"
fi

# ── Step 4: Copy files ────────────────────────────────────────────────────────
header "Step 4/7 — Copy files"

mkdir -p "${INSTALL_DIR}"
rsync -a --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='dist/' \
  --exclude='*.map' \
  --exclude='.env' \
  --exclude='.agents' \
  --exclude='.local' \
  --exclude='.cache' \
  "${PROJECT_ROOT}/" "${INSTALL_DIR}/"
success "Files copied to ${INSTALL_DIR}"

# ── Step 5: Secrets ───────────────────────────────────────────────────────────
header "Step 5/7 — Secrets"

ENV_FILE="${INSTALL_DIR}/.env"

if [[ -f "${ENV_FILE}" ]]; then
  warn ".env already exists — keeping existing secrets (delete ${ENV_FILE} to regenerate)"
else
  SESSION_SECRET=$(set +o pipefail; tr -dc 'A-Za-z0-9' </dev/urandom | head -c 48)
  POSTGRES_PASSWORD=$(set +o pipefail; tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32)

  DETECTED_IP=$(curl -sf https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
  DEFAULT_BETTER_AUTH_URL="http://${DETECTED_IP}:8085"

  echo ""
  read -rp "  BETTER_AUTH_URL     [${DEFAULT_BETTER_AUTH_URL}]: " INPUT_URL
  BETTER_AUTH_URL="${INPUT_URL:-${DEFAULT_BETTER_AUTH_URL}}"

  echo ""
  echo -e "  ${CYAN}Admin emails${RESET} — comma-separated, can access /admin"
  read -rp "  ADMIN_EMAILS        : " ADMIN_EMAILS
  [[ -z "${ADMIN_EMAILS}" ]] && warn "No admin email set — /admin will be inaccessible until you add ADMIN_EMAILS to ${ENV_FILE}"

  echo ""
  echo -e "  ${CYAN}GitHub Token (optional — raises lab-sync rate limit 60 → 5,000 req/hr)${RESET}"
  read -rp "  GITHUB_TOKEN        : " GITHUB_TOKEN
  echo ""

  TRUSTED_ORIGINS=""
  if [[ "${BETTER_AUTH_URL}" != "http://${DETECTED_IP}:8085" && -n "${DETECTED_IP}" ]]; then
    TRUSTED_ORIGINS="http://${DETECTED_IP}:8085"
  fi

  [[ "${BETTER_AUTH_URL}" == https://* ]] && SECURE_COOKIES="true" || SECURE_COOKIES="false"

  # DATABASE_URL is computed here so k8s pods get it from the secret directly
  # (docker-compose used to construct it inline; k8s envFrom needs it explicit)
  DATABASE_URL="postgresql://linuxlabs:${POSTGRES_PASSWORD}@postgres:5432/linuxlabs"

  {
    echo "# Auto-generated by DevLabMaster installer"
    echo "SESSION_SECRET=${SESSION_SECRET}"
    echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
    echo "DATABASE_URL=${DATABASE_URL}"
    echo "BETTER_AUTH_URL=${BETTER_AUTH_URL}"
    echo "TRUSTED_ORIGINS=${TRUSTED_ORIGINS}"
    echo "SECURE_COOKIES=${SECURE_COOKIES}"
    echo "GITHUB_TOKEN=${GITHUB_TOKEN}"
    echo "ADMIN_EMAILS=${ADMIN_EMAILS}"
  } > "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
  success "Secrets written to ${ENV_FILE}"
fi

set -o allexport; source "${ENV_FILE}"; set +o allexport
[[ -n "${SESSION_SECRET:-}"    ]] || die "SESSION_SECRET missing from ${ENV_FILE}."
[[ -n "${BETTER_AUTH_URL:-}"   ]] || die "BETTER_AUTH_URL missing from ${ENV_FILE}."
[[ -n "${POSTGRES_PASSWORD:-}" ]] || die "POSTGRES_PASSWORD missing from ${ENV_FILE}."

# ── Step 6: k8s namespace + secret ───────────────────────────────────────────
header "Step 6/7 — k8s bootstrap"

# postgres.yaml also contains the namespace definition
kubectl apply -f "${INSTALL_DIR}/k8s/postgres.yaml"

# Create/update the secret from .env (idempotent)
kubectl create secret generic devlabmaster-env \
  --namespace devlabmaster \
  --from-env-file="${ENV_FILE}" \
  --dry-run=client -o yaml | kubectl apply -f -
info "Waiting for postgres to be ready..."
kubectl rollout status statefulset/postgres -n devlabmaster --timeout=120s
success "Postgres ready"

# ── Step 7: Build + deploy ────────────────────────────────────────────────────
header "Step 7/7 — Build and deploy"

IMAGE_TAG="install-$(date +%Y%m%d%H%M%S)"

info "Building images (first run takes 3–5 minutes)..."
docker build --target migrate -t "localhost:5000/devlabmaster-migrate:${IMAGE_TAG}" "${INSTALL_DIR}"
docker build --target api    -t "localhost:5000/devlabmaster-api:${IMAGE_TAG}"     "${INSTALL_DIR}"
docker build --target web    -t "localhost:5000/devlabmaster-web:${IMAGE_TAG}"     "${INSTALL_DIR}"

docker push "localhost:5000/devlabmaster-migrate:${IMAGE_TAG}"
docker push "localhost:5000/devlabmaster-api:${IMAGE_TAG}"
docker push "localhost:5000/devlabmaster-web:${IMAGE_TAG}"
success "Images pushed to local registry"

info "Pre-pulling lab sandbox images so labs start instantly..."
info "(failures are non-fatal — images will be pulled lazily on first lab start)"
pull_image() {
  local img="$1"
  docker pull "${img}" && return 0
  warn "Could not pre-pull ${img} — lab will pull it on first use"
}
pull_image ubuntu:24.04
pull_image alpine:latest
pull_image alpine/git:latest
pull_image alpine/k8s:1.30.2
pull_image hashicorp/terraform:1.9
pull_image rastasheep/ubuntu-sshd:18.04
pull_image localstack/localstack:latest
pull_image docker:dind
pull_image cytopia/ansible:latest
pull_image "${JENKINS_GUI_IMAGE}"
success "Lab image pre-pull complete"

# ── Backup existing data before migration ─────────────────────────────────────
# If postgres is already running (reinstall / upgrade), create the same verified
# single-retained backup used by the daily schedule before applying migrations.
BACKUP_DIR="${INSTALL_DIR}/backups"
mkdir -p "${BACKUP_DIR}"

POSTGRES_POD=$(kubectl get pods -n devlabmaster -l app=postgres \
  -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
if [[ -n "${POSTGRES_POD}" ]]; then
  info "Existing database detected — creating a verified backup ..."
  if INSTALL_DIR="${INSTALL_DIR}" BACKUP_DIR="${BACKUP_DIR}" \
      bash "${INSTALL_DIR}/scripts/backup/create-k8s-backup.sh"; then
    success "Verified migration backup saved"
    # Remove legacy installer/migration dumps only after the replacement is
    # complete, leaving exactly one backup under the new policy.
    rm -f "${BACKUP_DIR}"/linuxlabs-*.sql "${BACKUP_DIR}"/compose-migration-*.sql
  else
    die "Backup failed — refusing to run a schema migration without a verified backup."
  fi
else
  info "Fresh install — no existing database to back up"
fi

info "Running database migration..."
kubectl delete job migrate -n devlabmaster --ignore-not-found=true

# Pre-pull into k3s containerd so the pod starts immediately without a cold pull
info "Pre-pulling migrate image into k3s containerd..."
k3s crictl pull "localhost:5000/devlabmaster-migrate:${IMAGE_TAG}" \
  || warn "crictl pre-pull failed — job will pull at runtime (may be slower)"

export IMAGE_TAG
envsubst '${IMAGE_TAG}' < "${INSTALL_DIR}/k8s/migrate.yaml" | kubectl apply -f -

# Stream pod logs in real-time so progress is visible while we wait
info "Waiting for migrate pod to start..."
LOG_PID=""
for _i in $(seq 1 30); do
  MIGRATE_POD=$(kubectl get pods -n devlabmaster \
    -l "batch.kubernetes.io/job-name=migrate" \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
  if [[ -n "${MIGRATE_POD}" ]]; then
    kubectl wait pod/"${MIGRATE_POD}" -n devlabmaster \
      --for=condition=Ready --timeout=30s 2>/dev/null || true
    kubectl logs -n devlabmaster "${MIGRATE_POD}" -f 2>/dev/null &
    LOG_PID=$!
    break
  fi
  sleep 2
done

if kubectl wait job/migrate -n devlabmaster --for=condition=complete --timeout=120s 2>/dev/null; then
  [[ -n "${LOG_PID}" ]] && kill "${LOG_PID}" 2>/dev/null || true
  success "Migration complete"
else
  [[ -n "${LOG_PID}" ]] && kill "${LOG_PID}" 2>/dev/null || true
  warn "Migration status:"
  kubectl get pods -n devlabmaster -l "batch.kubernetes.io/job-name=migrate" 2>/dev/null || true
  warn "Pod logs:"
  kubectl logs -n devlabmaster job/migrate --tail=100 2>/dev/null || true
  die "Database migration failed — see logs above."
fi

info "Deploying api and web..."
envsubst '${IMAGE_TAG}' < "${INSTALL_DIR}/k8s/app.yaml" | kubectl apply -f -
kubectl rollout status deployment/api -n devlabmaster --timeout=120s
kubectl rollout status deployment/web -n devlabmaster --timeout=120s
success "Deployment complete"

# Create or refresh the single retained backup immediately after deployment.
# This ensures a fresh install has a verified backup before the first 02:00 run.
header "Initial verified backup"
if INSTALL_DIR="${INSTALL_DIR}" BACKUP_DIR="${BACKUP_DIR}" \
    bash "${INSTALL_DIR}/scripts/backup/create-k8s-backup.sh"; then
  success "Exactly one verified backup is ready"
else
  die "Initial backup failed — installation cannot complete without a verified backup."
fi

# ── Daily backup schedule ─────────────────────────────────────────────────────
header "Backup schedule"
if PROJECT_DIR="${INSTALL_DIR}" \
    BACKUP_DIR="${BACKUP_DIR}" \
    BACKUP_SCRIPT="${INSTALL_DIR}/scripts/backup/create-k8s-backup.sh" \
    bash "${INSTALL_DIR}/scripts/backup/install-cron.sh"; then
  success "Daily verified backup scheduled for 02:00"
else
  warn "Could not install the daily backup schedule. Run scripts/backup/install-cron.sh manually."
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}${GREEN}  DevLabMaster is installed and running!          ${RESET}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "  ${BOLD}Open your browser:${RESET}  ${BOLD}http://localhost:8085${RESET}"
echo ""
echo -e "  ${CYAN}Useful commands:${RESET}"
echo -e "    kubectl get pods -n devlabmaster          — pod status"
echo -e "    kubectl logs -n devlabmaster deploy/api   — api logs"
echo -e "    kubectl rollout undo deployment/api -n devlabmaster  — rollback api"
echo -e "    kubectl rollout undo deployment/web -n devlabmaster  — rollback web"
echo ""
echo -e "  Files:  ${INSTALL_DIR}"
echo -e "  Config: ${ENV_FILE}"
echo ""
