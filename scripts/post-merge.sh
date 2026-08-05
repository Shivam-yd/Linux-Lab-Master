#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm run typecheck:libs   # build lib declaration files (needed for tsc --noEmit)
pnpm --filter db push

# Pre-pull every image referenced by the lab registry. The api-server also
# warms these on its own startup, but doing it here too means a fresh
# environment doesn't wait on the server's background pull before the
# first lab can start.
for img in \
  docker:dind \
  alpine/git:latest \
  ubuntu:24.04 \
  alpine:latest \
  hashicorp/terraform:1.9 \
  localstack/localstack:latest \
  cytopia/ansible:latest \
  alpine/k8s:1.30.2 \
  jenkins/jenkins:lts-jdk17; do
  docker pull "$img" || echo "warning: failed to pull $img (labs using it will error until this is resolved)"
done
