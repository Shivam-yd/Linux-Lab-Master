---
name: Docker sandbox constraints in this environment
description: Container internet/DNS access has been observed as both unavailable and available at different times — do not assume either way, verify empirically. Applies to any project that spins up Docker containers on Replit (e.g. lab/sandbox platforms).
---

- Container internet/DNS access is **inconsistent across sessions** — do not hardcode an assumption either way.
  **Why:** on one occasion a lab's `setupScript` ran `apt-get install -y cron at` on `ubuntu:24.04` and it failed silently (no internet/DNS). On a later date (2026-07-14), `apt-get update && apt-get install -y libxml2-utils` on the same `ubuntu:24.04` image succeeded fully (packages downloaded and installed) both via plain `docker run` and via a container created the same way the api-server's `dockerode` code creates lab containers (default bridge network, no explicit `NetworkMode`).
  **How to apply:** never *assume* network availability when writing or reviewing a `setupScript`/runtime install step — test empirically first with `docker run --rm <image> bash -lc 'apt-get update && apt-get install -y <pkg> && which <tool>'` (or the image's equivalent package manager). Still prefer pre-built images that already bundle required tools where practical, since even when network access works today it may not tomorrow — but do not block or rewrite a working setupScript solely because of the old no-internet assumption without re-testing it live first.
- `docker pull` for a container's base `image` still works fine (images are pulled ahead of time) — only in-container runtime installs are blocked.
- Users need `chpasswd` for sshd-style images; `sudo` is unavailable inside containers.
- If building tooling that manages Docker programmatically (e.g. via `dockerode`), bundle `ssh2`/`@grpc` rather than externalizing them.
- Before trusting any script that assumes a tool exists in an image, verify with `docker run --rm <image> sh -c 'which <tool1> <tool2>'` rather than assuming from the image's reputation.
