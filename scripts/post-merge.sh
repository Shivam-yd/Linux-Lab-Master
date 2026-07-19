#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm run typecheck:libs   # build lib declaration files (needed for tsc --noEmit)
pnpm --filter db push

# Pre-pull Docker images the lab sandboxes depend on. The api-server also
# warms these on its own startup, but doing it here too means a fresh
# environment doesn't wait on the server's background pull before the
# first lab can start.
for img in ubuntu:24.04 alpine:latest rastasheep/ubuntu-sshd:18.04 hashicorp/terraform:1.9; do
  docker pull "$img" || echo "warning: failed to pull $img (labs using it will error until this is resolved)"
done
