---
name: Docker sandbox constraints in this environment
description: Containers run with no internet/DNS access; package managers and downloads never work at runtime. Applies to any project that spins up Docker containers on Replit (e.g. lab/sandbox platforms).
---

- Containers spawned in this Replit environment have **no outbound internet/DNS**. `apt-get`, `apk add`, `pip install`, `npm install`, `curl <url>`, `wget <url>`, `git clone` all fail (often silently) inside a running container.
  **Why:** confirmed by repeated testing — a lab's `setupScript` ran `apt-get install -y cron at` on `ubuntu:24.04` and it failed silently, so the tools were never present at verify time even though the script "succeeded".
  **How to apply:** never write a setup/init script that installs packages at container runtime. Instead: (1) pick a pre-built image that already bundles the needed tool, (2) for minimal images prefer Alpine + BusyBox — it bundles crond/crontab, vi, core-utils, etc. (check with `docker run --rm <image> busybox --list`), or (3) if nothing ships the tool, write a small POSIX-`sh` shim in the setup script that fakes the needed behavior (validate input; don't silently no-op on bad input).
- `docker pull` for a container's base `image` still works fine (images are pulled ahead of time) — only in-container runtime installs are blocked.
- Users need `chpasswd` for sshd-style images; `sudo` is unavailable inside containers.
- If building tooling that manages Docker programmatically (e.g. via `dockerode`), bundle `ssh2`/`@grpc` rather than externalizing them.
- Before trusting any script that assumes a tool exists in an image, verify with `docker run --rm <image> sh -c 'which <tool1> <tool2>'` rather than assuming from the image's reputation.
