---
name: Pulled code dependency restore
description: Workspace dependency state can lag behind a pulled lockfile and cause misleading missing-module errors.
---

When code is pulled into this monorepo, the lockfile and package manifests may already contain the required dependencies while the local `node_modules` tree is incomplete. Restore from the existing lockfile with `pnpm install --frozen-lockfile` before diagnosing missing imports as code defects.

**Why:** A fresh or partially reused workspace produced missing-module errors for dependencies that were already declared and locked; reinstalling from the lockfile restored the app without changing dependency declarations.

**How to apply:** After pulling or importing code, run the frozen workspace install before restarting the API and frontend workflows.