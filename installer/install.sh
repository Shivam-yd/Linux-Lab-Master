#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# DevLabMaster — Ubuntu installer
#
# Usage (from the project root):
#   sudo bash installer/install.sh
#
# What it does:
#   1. Installs Docker Engine + Compose plugin (if missing)
#   2. Copies the project to /opt/linuxlabs
#   3. Generates random secrets and configures Better Auth / Google OAuth
#   4. Builds Docker images and pre-pulls lab container images
#   5. Installs and starts a systemd service (auto-starts on boot)
#
# Platform features installed:
#   • Lab catalog   — browse and launch sandboxed Linux/Docker/Git/Terraform labs
#   • Progress      — per-user progress tracker across all tracks (/progress)
#   • Profile       — account settings and password management (/profile)
#   • Certificates  — auto-generated on 100% track completion and shareable via
#                     public verification links (/certificate/:track, /verify/:id)
#   • Guest mode    — try labs without an account (progress saved by cookie)
#   • Google OAuth  — optional; configure GOOGLE_CLIENT_ID/SECRET in .env
#
# Supported: Ubuntu 20.04 LTS, 22.04 LTS, 24.04 LTS
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[•]${RESET} $*"; }
success() { echo -e "${GREEN}[✓]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[!]${RESET} $*"; }
die()     { echo -e "${RED}[✗]${RESET} $*" >&2; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}── $* ──${RESET}"; }

# ── Constants ─────────────────────────────────────────────────────────────────
INSTALL_DIR="/opt/linuxlabs"
SERVICE_NAME="linuxlabs"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ── Preflight checks ──────────────────────────────────────────────────────────
header "Preflight"

[[ $EUID -eq 0 ]] || die "Please run as root:  sudo bash installer/install.sh"

[[ -f "${PROJECT_ROOT}/docker-compose.yml" ]] || \
  die "docker-compose.yml not found at ${PROJECT_ROOT}. Run this script from the project root."

if [[ -f /etc/os-release ]]; then
  source /etc/os-release
  [[ "${ID:-}" == "ubuntu" ]] || warn "This script targets Ubuntu; continuing anyway on ${PRETTY_NAME:-unknown}."
else
  warn "/etc/os-release not found — OS check skipped."
fi

success "Preflight passed"

# ── Step 1: Install Docker + utilities ───────────────────────────────────────
header "Step 1/6 — Docker"

install_docker() {
  info "Installing Docker Engine via the official apt repository..."
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg lsb-release

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
                          docker-buildx-plugin docker-compose-plugin
}

if command -v docker &>/dev/null && docker info &>/dev/null; then
  success "Docker is already installed and running ($(docker --version))"
else
  install_docker
  systemctl enable --now docker
  success "Docker installed and started"
fi

if ! docker compose version &>/dev/null; then
  info "Installing Docker Compose plugin..."
  apt-get install -y -qq docker-compose-plugin
fi
success "Docker Compose available ($(docker compose version))"

# rsync is used to copy the project tree — ensure it is present.
# It is usually pre-installed on Ubuntu but not guaranteed on minimal images.
if ! command -v rsync &>/dev/null; then
  info "Installing rsync..."
  apt-get install -y -qq rsync
fi
success "rsync available"

# ── Step 2: Copy project files ────────────────────────────────────────────────
header "Step 2/6 — Copy files"

info "Copying project to ${INSTALL_DIR} ..."
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

# ── Step 3: Generate secrets & configure Better Auth ─────────────────────────
header "Step 3/6 — Secrets"

ENV_FILE="${INSTALL_DIR}/.env"

if [[ -f "${ENV_FILE}" ]]; then
  warn ".env already exists — keeping existing secrets (delete ${ENV_FILE} to regenerate)"
else
  info "Generating random secrets..."
  # NOTE: /dev/urandom is an infinite stream — when `head` closes the pipe
  # early, `tr` receives SIGPIPE and exits non-zero. Under `set -o pipefail`
  # that would silently abort the whole script. Disable pipefail just for
  # these two lines so the broken-pipe exit is ignored.
  SESSION_SECRET=$(set +o pipefail; tr -dc 'A-Za-z0-9' </dev/urandom | head -c 48)
  POSTGRES_PASSWORD=$(set +o pipefail; tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32)

  # Auto-detect public IP as base for the default URL
  DETECTED_IP=$(curl -sf https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')

  DEFAULT_BETTER_AUTH_URL="http://${DETECTED_IP}:8085"

  echo ""
  read -rp "  BETTER_AUTH_URL     [${DEFAULT_BETTER_AUTH_URL}]: " INPUT_URL
  BETTER_AUTH_URL="${INPUT_URL:-${DEFAULT_BETTER_AUTH_URL}}"

  echo ""
  echo -e "  ${CYAN}Google OAuth (optional — leave blank to skip; 'Continue with Google' will be hidden)${RESET}"
  echo -e "  Create credentials at: https://console.cloud.google.com/apis/credentials"
  read -rp "  GOOGLE_CLIENT_ID     : " GOOGLE_CLIENT_ID
  read -rp "  GOOGLE_CLIENT_SECRET : " GOOGLE_CLIENT_SECRET

  if [[ -n "${GOOGLE_CLIENT_ID}" ]]; then
    echo ""
    echo -e "  ${YELLOW}[!] Google Console — add this Authorised redirect URI to your OAuth client:${RESET}"
    echo -e "      ${BOLD}${BETTER_AUTH_URL}/api/auth/callback/google${RESET}"
    echo -e "  Without it Google will reject the sign-in with a redirect_uri_mismatch error."
    echo ""
  fi

  echo ""
  echo -e "  ${CYAN}Admin emails${RESET} — comma-separated list of accounts that can access /admin"
  echo -e "  (password-reset approvals, leaderboard, session management, etc.)"
  read -rp "  ADMIN_EMAILS        : " ADMIN_EMAILS
  if [[ -z "${ADMIN_EMAILS}" ]]; then
    warn "No admin email set — the /admin panel will be inaccessible until you add ADMIN_EMAILS to ${ENV_FILE}"
  fi

  echo ""
  echo -e "  ${CYAN}GitHub Token (optional — raises lab-sync rate limit from 60 → 5,000 req/hr)${RESET}"
  echo -e "  Create a token at: https://github.com/settings/tokens (no scopes needed for public repos)"
  read -rp "  GITHUB_TOKEN        : " GITHUB_TOKEN
  echo ""

  # If BETTER_AUTH_URL is a domain (not a raw IP URL), also trust the raw IP
  # so users can reach the app directly via http://<ip>:8085 without 403 errors.
  TRUSTED_ORIGINS=""
  if [[ "${BETTER_AUTH_URL}" != "http://${DETECTED_IP}:8085" && -n "${DETECTED_IP}" ]]; then
    TRUSTED_ORIGINS="http://${DETECTED_IP}:8085"
  fi

  # Secure cookies only make sense over HTTPS.
  # On plain HTTP (the common self-hosted case) the browser silently drops every
  # Secure cookie → state_mismatch on Google login, sessions not saved/cleared.
  if [[ "${BETTER_AUTH_URL}" == https://* ]]; then
    SECURE_COOKIES="true"
  else
    SECURE_COOKIES="false"
  fi

  {
    echo "# Auto-generated by DevLabMaster installer"
    echo "SESSION_SECRET=${SESSION_SECRET}"
    echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
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

# Validate an existing configuration before Docker Compose interpolates it.
# This prevents a stale or hand-edited .env from starting a broken API service.
set -o allexport
# shellcheck source=/dev/null
source "${ENV_FILE}"
set +o allexport
[[ -n "${SESSION_SECRET:-}" ]] || die "SESSION_SECRET is missing from ${ENV_FILE}. Delete the file to regenerate it."
[[ -n "${BETTER_AUTH_URL:-}" ]] || die "BETTER_AUTH_URL is missing from ${ENV_FILE}. Delete the file and rerun the installer."

# ── Step 4: Build Docker images ───────────────────────────────────────────────
header "Step 4/6 — Build images"

info "Stopping any existing containers..."
docker compose --project-directory "${INSTALL_DIR}" down --remove-orphans 2>/dev/null || true

info "Building Docker images (first run takes 3–5 minutes)..."
docker compose --project-directory "${INSTALL_DIR}" build
success "Images built"

# ── Step 5: Pull lab container images ─────────────────────────────────────────
header "Step 5/6 — Pull lab images"

# Pull every image referenced by lab YAML files so sandbox startup is instant.
# Adding a new lab that uses a different image? Add a matching `docker pull`
# here AND in installer/setup.iss (the Windows installer) so both platforms
# pre-cache it.
#
# Shell-compatibility reference (affects setupScript / verifyScript authoring):
#   ubuntu:24.04              /bin/sh = dash   — [[ ]] NOT supported; use shell: "bash"
#   alpine:latest             /bin/sh = ash    — [[ ]] NOT supported; use shell: "sh"
#   alpine/git:latest         /bin/sh = ash    — [[ ]] NOT supported; use shell: "sh"
#   hashicorp/terraform:1.9   /bin/sh = ash    — [[ ]] NOT supported; use shell: "sh"
#   rastasheep/ubuntu-sshd    /bin/sh = dash   — [[ ]] NOT supported; use shell: "bash"
#   localstack/localstack     /bin/sh = bash   — [[ ]] supported; use shell: "bash"
info "Pulling lab sandbox images so labs start instantly..."
docker pull ubuntu:24.04
docker pull alpine:latest
docker pull alpine/git:latest
docker pull hashicorp/terraform:1.9
docker pull rastasheep/ubuntu-sshd:18.04
docker pull localstack/localstack:latest
success "Lab images ready"

# ── Step 6: Install systemd service ───────────────────────────────────────────
header "Step 6/6 — Systemd service"

COMPOSE_BIN="$(command -v docker)"   # "docker compose" is a plugin

cat > "${SERVICE_FILE}" <<EOF
[Unit]
Description=DevLabMaster Learning Platform
Documentation=file://${INSTALL_DIR}/installer/README.md
After=docker.service network-online.target
Requires=docker.service
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${INSTALL_DIR}/.env

# Start: docker compose up (foreground — systemd manages the process)
ExecStart=${COMPOSE_BIN} compose \
  --project-directory ${INSTALL_DIR} \
  --env-file ${ENV_FILE} \
  up --no-build

# Stop: tear down containers gracefully
ExecStop=${COMPOSE_BIN} compose \
  --project-directory ${INSTALL_DIR} \
  --env-file ${ENV_FILE} \
  down

# Run the DB migration before starting on each boot
# (drizzle-kit push is idempotent — safe to run every time)
ExecStartPre=${COMPOSE_BIN} compose \
  --project-directory ${INSTALL_DIR} \
  --env-file ${ENV_FILE} \
  run --rm migrate

Restart=on-failure
RestartSec=15
TimeoutStartSec=300
TimeoutStopSec=60

# Send stdout/stderr to journald (view with: journalctl -u ${SERVICE_NAME})
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"

info "Starting service..."
if ! systemctl restart "${SERVICE_NAME}"; then
  echo ""
  echo -e "${RED}[✗] Service failed to start. Recent logs:${RESET}"
  journalctl -u "${SERVICE_NAME}" -n 40 --no-pager
  die "Fix the error above, then run: sudo systemctl start ${SERVICE_NAME}"
fi

# Wait for the app to respond (up to 90 s)
info "Waiting for the app to become ready..."
READY=0
for i in $(seq 1 30); do
  if curl -sf http://localhost:8085/ -o /dev/null 2>/dev/null; then
    READY=1
    break
  fi
  echo -e "  ${CYAN}[${i}/30]${RESET} still starting… (${i}s / 90s max)"
  sleep 3
done

if [[ "${READY}" -eq 0 ]]; then
  warn "App did not respond within 90 s. Check logs: journalctl -u ${SERVICE_NAME} -n 60"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}${GREEN}  DevLabMaster is installed and running!          ${RESET}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "  ${BOLD}Open your browser:${RESET}  ${BOLD}http://localhost:8085${RESET}"
echo ""
echo -e "  ${CYAN}Pages:${RESET}"
echo -e "    http://localhost:8085/           — home / sign in"
echo -e "    http://localhost:8085/dashboard  — lab catalog"
echo -e "    http://localhost:8085/progress   — your progress across all tracks"
echo -e "    http://localhost:8085/profile    — account settings & password"
echo -e "    http://localhost:8085/certificate/:track  — completion certificate and Share link"
echo -e "    http://localhost:8085/verify/:id           — public certificate verification"
echo ""
echo -e "  ${CYAN}Service commands:${RESET}"
echo -e "    ${CYAN}sudo systemctl status  ${SERVICE_NAME}${RESET}   — check status"
echo -e "    ${CYAN}sudo systemctl stop    ${SERVICE_NAME}${RESET}   — stop"
echo -e "    ${CYAN}sudo systemctl start   ${SERVICE_NAME}${RESET}   — start"
echo -e "    ${CYAN}sudo systemctl restart ${SERVICE_NAME}${RESET}   — restart"
echo -e "    ${CYAN}journalctl -u ${SERVICE_NAME} -f${RESET}         — live logs"
echo ""
echo -e "  Files:  ${INSTALL_DIR}"
echo -e "  Config: ${ENV_FILE}"
echo ""
