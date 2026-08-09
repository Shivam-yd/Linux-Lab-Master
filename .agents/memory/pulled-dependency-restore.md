---
name: Pulled dependency restore
description: A pulled workspace may have incomplete node_modules even when the lockfile is correct.
---

After pulling the project, a frozen lockfile install may be required before starting the frontend. Prefer `pnpm install --frozen-lockfile`; offline mode can fail if a transitive package is absent from the local pnpm store.

**Why:** The frontend package manifests and lockfile were correct, but stale local modules caused unresolved imports until the full lockfile install completed.

**How to apply:** When Vite reports missing imports after a pull, check the manifests and lockfile first, then restore with the frozen lockfile before changing code or dependency versions.