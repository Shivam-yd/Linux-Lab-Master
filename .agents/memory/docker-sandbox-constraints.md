---
name: Docker sandbox constraints in this environment
description: Durable constraints discovered running real Docker containers (dockerode) from an api-server in this Replit environment — networking, auth, and bundling gotchas.
---

## No outbound internet inside containers
Containers in this environment cannot resolve DNS or reach the general internet (verified against archive.ubuntu.com, alpinelinux.org CDN, etc). `apt-get install` / `apk add` do not work, at container runtime or at `docker build` time.

`docker pull` of pre-built images DOES work (registry pulls are allowed even though general egress isn't). **How to apply:** never design a lab/feature around installing packages inside a container. Pick a pre-built image that already has what you need (e.g. `rastasheep/ubuntu-sshd` for a working sshd+useradd, `alpine` for busybox cron, plain `ubuntu:24.04` for stock coreutils/shadow-utils/bash/tar).

## Freshly-created users and SSH
`useradd -m` creates a user with a locked password (`!` in shadow) by default. Some sshd/PAM account-validation paths reject even pubkey auth for such users with a misleading "invalid user" error, even though `getent passwd` shows the user is fine.

**Why:** confirmed on both a Nix-provided sshd and a native `rastasheep/ubuntu-sshd:18.04` image — not specific to one sshd build.
**How to apply:** always run `chpasswd` to set a password for any user a script creates, even when the real login path is passwordless SSH keys.

## sudo is unreliable here
Real `sudo` is unavailable/shimmed in this Replit environment (host `sudo` is intercepted with a warning). Inside your own Docker containers, don't assume `sudo` exists either — prefer running as root directly, or use `su - <user> -c '...'`, which is a genuine unmodified binary on stock Debian/Ubuntu images.

## Alpine has no bash
Alpine-based images only ship POSIX `sh` (busybox), not bash. Any script run via `docker exec` across a fleet of differently-based images (Ubuntu + Alpine) should stick to POSIX-safe shell (no bashisms: no `[[`, arrays, `local`) and be invoked as `sh -lc '...'`, not `bash -lc`.

## dockerode bundling (esbuild)
`dockerode`'s `lib/session.js` unconditionally `require()`s `ssh2`, `@grpc/grpc-js`, and `@grpc/proto-loader` at module load time, even though a plain Unix-socket connection never uses them. If an esbuild bundle marks those packages `external` (common default in monorepo build scripts) but they aren't installed as real dependencies, the built server crashes at startup with `Cannot find module 'ssh2'` / `@grpc/...`.

**Fix:** either install `ssh2`, `@grpc/grpc-js`, `@grpc/proto-loader` as real dependencies, or (cleaner) remove them from the esbuild `external` list so they get bundled — do the latter plus install them, so no runtime `node_modules` resolution is needed at all.
