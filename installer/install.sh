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
#   5. Generates random secrets and configures Better Auth / Google OAuth
#   6. Creates the devlabmaster k8s namespace + secret
#   7. Builds Docker images and deploys them
#   8. Pre-pulls lab container images so sandbox startup is instant
#
# Subsequent deploys are handled by GitHub Actions (zero-downtime rolling
# update) — re-running this script is only needed after wiping the server.
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

# ── Preflight ─────────────────────────────────────────────────────────────────
header "Preflight"

[[ $EUID -eq 0 ]] || die "Please run as root:  sudo bash installer/install.sh"

[[ -f "${PROJECT_ROOT}/Dockerfile" ]] || \
  die "Run this script from the project root."

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

if command -v docker &>/dev/null && docker info &>/dev/null; then
  success "Docker already running ($(docker --version))"
else
  install_docker
  systemctl enable --now docker
  success "Docker installed"
fi

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

# Tell k3s to trust the local registry before it starts
mkdir -p /etc/rancher/k3s
cat > /etc/rancher/k3s/registries.yaml <<'EOF'
mirrors:
  "localhost:5000":
    endpoint:
      - "http://localhost:5000"
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

  # docker group membership only takes effect after re-login/service restart,
  # so also grant passwordless sudo for docker so CI works immediately.
  usermod -aG docker github-runner
  cat > /etc/sudoers.d/github-runner-docker <<'EOF'
github-runner ALL=(ALL) NOPASSWD: /usr/bin/docker
EOF
  chmod 440 /etc/sudoers.d/github-runner-docker
  success "github-runner granted docker access (group + sudo)"
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
  echo -e "  ${CYAN}Google OAuth (optional — leave blank to skip)${RESET}"
  read -rp "  GOOGLE_CLIENT_ID     : " GOOGLE_CLIENT_ID
  read -rp "  GOOGLE_CLIENT_SECRET : " GOOGLE_CLIENT_SECRET

  if [[ -n "${GOOGLE_CLIENT_ID}" ]]; then
    echo ""
    echo -e "  ${YELLOW}[!] Add this Authorised redirect URI in Google Console:${RESET}"
    echo -e "      ${BOLD}${BETTER_AUTH_URL}/api/auth/callback/google${RESET}"
    echo ""
  fi

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
    echo "GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}"
    echo "GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}"
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
success "Lab image pre-pull complete"

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
