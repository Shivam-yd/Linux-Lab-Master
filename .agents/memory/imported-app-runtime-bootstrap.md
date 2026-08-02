---
name: Imported app runtime bootstrap
description: Startup requirements after replacing a workspace with an existing full-stack repository
---

After importing a full-stack repository into an existing workspace, restart every managed workflow that was already running and apply the repository's development database schema before testing stateful flows. Otherwise an old in-memory server can continue serving stale routes while the new source has no generated build, and session-backed features fail when expected tables are absent.

**Why:** A project replacement can leave old workflow processes alive across the file swap; this produced mixed old/new API behavior and hid the missing schema behind an apparently healthy health endpoint.

**How to apply:** Restart the API and web workflows after the import, run the repository's normal development schema push, then verify a health route, one feature route, and the relevant service/container readiness path.