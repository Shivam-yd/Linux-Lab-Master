---
name: Mockup sandbox build environment
description: Required environment variables for building the mockup sandbox artifact.
---

The mockup sandbox Vite config requires both `PORT` and `BASE_PATH` even for a
production build. The package build script must provide deterministic defaults;
the dev workflow continues to supply its runtime port.

**Why:** A workspace-wide build failed despite the preview workflow running
correctly because the package build command invoked Vite without those values.

**How to apply:** Keep `PORT=3000 BASE_PATH=/` (or equivalent explicit values)
on the mockup sandbox build command, and preserve the stricter validation in
the Vite config for runtime workflows.