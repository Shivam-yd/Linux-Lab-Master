# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: builder — installs all dependencies and compiles every package
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

# python3 + build-essential give node-gyp what it needs to compile
# native addons (e.g. ssh2's optional crypto binding).
RUN apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@10.26.1

WORKDIR /app
COPY . .

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Build API server (esbuild → artifacts/api-server/dist/)
RUN pnpm --filter @workspace/api-server run build

# Build frontend (Vite → artifacts/linux-labs/dist/public/)
RUN PORT=3000 BASE_PATH=/ pnpm --filter @workspace/devlabmaster run build


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: migrate — runs drizzle-kit push once at startup, then exits
# Reuses the builder image so drizzle-kit and the db package are already there
# ─────────────────────────────────────────────────────────────────────────────
# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: migrate — lean image with only the db package and drizzle-kit.
# Kept separate from the builder so the image is ~200 MB instead of ~2-3 GB,
# making cold pulls from the local registry much faster.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS migrate

RUN npm install -g pnpm@10.26.1

WORKDIR /app

# Workspace root config needed for pnpm to resolve the lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# Full source for the db package (schema + config)
COPY lib/db ./lib/db

# pnpm requires every workspace member referenced in pnpm-workspace.yaml to
# exist on disk. Copy only the package.json stubs — no source needed.
COPY scripts/package.json                 ./scripts/
COPY lib/api-client-react/package.json   ./lib/api-client-react/
COPY lib/api-spec/package.json           ./lib/api-spec/
COPY lib/api-zod/package.json            ./lib/api-zod/
COPY artifacts/api-server/package.json   ./artifacts/api-server/
COPY artifacts/linux-labs/package.json   ./artifacts/linux-labs/
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/

# Install ONLY @workspace/db and its declared deps (drizzle-kit, drizzle-orm, pg, zod)
RUN pnpm install --filter @workspace/db --frozen-lockfile

# Wait for postgres TCP, then push schema non-interactively.
# `yes` pipes "y" to any drizzle-kit confirmation prompts so it never hangs.
CMD ["sh", "-c", "\
  if [ -z \"$DATABASE_URL\" ]; then \
    if [ -z \"$POSTGRES_PASSWORD\" ]; then \
      echo 'ERROR: Neither DATABASE_URL nor POSTGRES_PASSWORD is set in the devlabmaster-env secret.'; \
      exit 1; \
    fi; \
    export DATABASE_URL=\"postgresql://linuxlabs:${POSTGRES_PASSWORD}@postgres:5432/linuxlabs\"; \
    echo 'DATABASE_URL constructed from POSTGRES_PASSWORD.'; \
  fi && \
  echo 'Waiting for postgres TCP...' && \
  until node -e \"require('net').createConnection(5432,'postgres').on('connect',function(){process.exit(0)}).on('error',function(){process.exit(1)})\"; \
  do echo 'Waiting for postgres...'; sleep 2; done && \
  echo 'Postgres ready. Pushing schema...' && \
  yes | pnpm --filter @workspace/db run push-force \
"]


# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: api — lean Node.js runtime, just the esbuild bundle
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS api

WORKDIR /app
RUN apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends bash postgresql-client util-linux && \
    rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/artifacts/api-server/dist ./dist
COPY scripts/backup ./scripts/backup

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]


# ─────────────────────────────────────────────────────────────────────────────
# Stage 4: web — nginx serves the static frontend and proxies /api → api:8080
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:alpine AS web

COPY --from=builder /app/artifacts/linux-labs/dist/public /usr/share/nginx/html
COPY installer/nginx.conf /etc/nginx/conf.d/default.conf
