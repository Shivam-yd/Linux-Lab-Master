# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: builder — installs all dependencies and compiles every package
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

RUN npm install -g pnpm@10.26.1

WORKDIR /app
COPY . .

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Build API server (esbuild → artifacts/api-server/dist/)
RUN pnpm --filter @workspace/api-server run build

# Build frontend (Vite → artifacts/linux-labs/dist/public/)
# VITE_CLERK_PUBLISHABLE_KEY is baked into the bundle at build time — pass it
# via --build-arg so the same image works with or without Clerk.
ARG VITE_CLERK_PUBLISHABLE_KEY=""
RUN PORT=3000 BASE_PATH=/ VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY} \
    pnpm --filter @workspace/linux-labs run build


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: migrate — runs drizzle-kit push once at startup, then exits
# Reuses the builder image so drizzle-kit and the db package are already there
# ─────────────────────────────────────────────────────────────────────────────
FROM builder AS migrate

CMD ["pnpm", "--filter", "@workspace/db", "run", "push"]


# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: api — lean Node.js runtime, just the esbuild bundle
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS api

WORKDIR /app
COPY --from=builder /app/artifacts/api-server/dist ./dist

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]


# ─────────────────────────────────────────────────────────────────────────────
# Stage 4: web — nginx serves the static frontend and proxies /api → api:8080
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:alpine AS web

COPY --from=builder /app/artifacts/linux-labs/dist/public /usr/share/nginx/html
COPY installer/nginx.conf /etc/nginx/conf.d/default.conf
