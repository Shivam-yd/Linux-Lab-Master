#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Linux Lab Master — Replit development setup
#
# Run once after cloning or importing this project on Replit.
# Safe to re-run; all steps are idempotent.
#
# Prerequisites (Replit Secrets that must be set before running):
#   SESSION_SECRET         — any long random string
#
# The following are auto-provisioned by Replit and must NOT be set manually:
#   DATABASE_URL, PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
#
# The following are set automatically as shared env vars:
#   BETTER_AUTH_URL        — public URL of the API server (set by Replit)
#
# Optional:
#   GITHUB_TOKEN           — raises GitHub API rate limit for lab YAML sync
#   LOG_LEVEL              — defaults to "info"
#   GOOGLE_CLIENT_ID       — for Google OAuth sign-in
#   GOOGLE_CLIENT_SECRET   — for Google OAuth sign-in
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; RESET='\033[0m'
info()    { echo -e "${CYAN}[•]${RESET} $*"; }
success() { echo -e "${GREEN}[✓]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[!]${RESET} $*"; }
die()     { echo -e "${RED}[✗]${RESET} $*" >&2; exit 1; }

# ── 1. Dependencies ───────────────────────────────────────────────────────────
info "Installing pnpm dependencies..."
pnpm install
success "Dependencies installed"

# ── 2. Required secrets check ─────────────────────────────────────────────────
info "Checking required secrets..."
MISSING=()
[[ -z "${SESSION_SECRET:-}" ]] && MISSING+=("SESSION_SECRET")
[[ -z "${DATABASE_URL:-}"   ]] && MISSING+=("DATABASE_URL")

if [[ ${#MISSING[@]} -gt 0 ]]; then
  die "Missing required environment variables: ${MISSING[*]}"
fi
success "All required secrets present"

# ── 3. Database schema push ───────────────────────────────────────────────────
info "Pushing database schema via Drizzle..."
cd lib/db
npx drizzle-kit push
cd ../..
success "Database schema up to date"

# ── 4. Done ───────────────────────────────────────────────────────────────────
success "Setup complete. Start the app with:"
echo "  pnpm --filter @workspace/api-server run dev   # API on \$PORT (default 8080)"
echo "  pnpm --filter @workspace/linux-labs run dev   # Frontend on \$PORT"
echo ""
echo "On Replit these are managed by the configured workflows."
