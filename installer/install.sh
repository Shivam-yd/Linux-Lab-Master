#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# LinuxLabMaster — Ubuntu installer
#
# Usage (from the project root):
#   sudo bash installer/install.sh
#
# What it does:
#   1. Installs Docker Engine + Compose plugin (if missing)
#   2. Copies the project to /opt/linuxlabs
#   3. Generates random secrets (Clerk keys optional)
#   4. Builds Docker images and pre-pulls lab container images
#   5. Installs and starts a systemd service (auto-starts on boot)
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

# ── Step 1: Install Docker ────────────────────────────────────────────────────
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

# ── Step 2: Copy project files ────────────────────────────────────────────────
header "Step 2/6 — Copy files"

info "Copying project to ${INSTALL_DIR} ..."
mkdir -p "${INSTALL_DIR}"

rsync -a --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='*/node_modules' \
  --exclude='*/dist' \
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

  # Auto-detect public IP for the Better Auth base URL
  DETECTED_IP=$(curl -sf https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
  BETTER_AUTH_URL="http://${DETECTED_IP}:8085"

  # Google OAuth credentials (embedded at install time)
  GOOGLE_CLIENT_ID="680196573745-eekfbd0kmpkilokn83asia4nsmq6q4m7.apps.googleusercontent.com"
  GOOGLE_CLIENT_SECRET="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"

  {
    echo "# Auto-generated by LinuxLabMaster installer"
    echo "SESSION_SECRET=${SESSION_SECRET}"
    echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
    echo "BETTER_AUTH_URL=${BETTER_AUTH_URL}"
    echo "GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}"
    echo "GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}"
  } > "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"

  success "Secrets written to ${ENV_FILE} (email/password + Google login enabled)"
fi

# ── Step 4: Build Docker images ───────────────────────────────────────────────
header "Step 4/6 — Build images"

# Source the .env so CLERK keys are available as shell vars for the build arg.
# (They may not be set if the .env already existed before this run.)
set -o allexport
# shellcheck source=/dev/null
source "${ENV_FILE}"
set +o allexport

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
#   localstack/localstack     /bin/sh = dash   — [[ ]] NOT supported; use shell: "bash"
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
Description=LinuxLabMaster Learning Platform
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
  up --no-build

# Stop: tear down containers gracefully
ExecStop=${COMPOSE_BIN} compose \
  --project-directory ${INSTALL_DIR} \
  down

# Run the DB migration before starting on each boot
# (drizzle-kit push is idempotent — safe to run every time)
ExecStartPre=${COMPOSE_BIN} compose \
  --project-directory ${INSTALL_DIR} \
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
systemctl restart "${SERVICE_NAME}"

# Wait for the app to respond (up to 90 s)
info "Waiting for the app to become ready..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:8085/ -o /dev/null 2>/dev/null; then
    break
  fi
  sleep 3
done

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}${GREEN}  LinuxLabMaster is installed and running!          ${RESET}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "  Open your browser:  ${BOLD}http://localhost:8085${RESET}"
echo ""
echo -e "  Service commands:"
echo -e "    ${CYAN}sudo systemctl status  ${SERVICE_NAME}${RESET}   — check status"
echo -e "    ${CYAN}sudo systemctl stop    ${SERVICE_NAME}${RESET}   — stop"
echo -e "    ${CYAN}sudo systemctl start   ${SERVICE_NAME}${RESET}   — start"
echo -e "    ${CYAN}sudo systemctl restart ${SERVICE_NAME}${RESET}   — restart"
echo -e "    ${CYAN}journalctl -u ${SERVICE_NAME} -f${RESET}         — live logs"
echo ""
echo -e "  Files:  ${INSTALL_DIR}"
echo -e "  Config: ${ENV_FILE}"
echo ""
