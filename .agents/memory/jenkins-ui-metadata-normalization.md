---
name: Jenkins UI metadata normalization
description: Jenkins GUI labs need service metadata in synced definitions for the embedded UI to render.
---

Jenkins GUI lab definitions must resolve to `useImageCmd: true`, `ports: [8080]`, and `uiPath: "/jenkins/"` before they are stored or consumed from remote lab records. Sync must repair older unchanged rows that lack this metadata, not only rows whose GitHub SHA changed.

**Why:** Older synced Jenkins records retained the image but lost the port and UI path, so the frontend's `uiPort` gate hid the UI tab and the manager could not publish the service port.

**How to apply:** Keep normalization at the GitHub-sync boundary and preserve the frontend fallback only for legacy cached records; verify all Jenkins GUI records expose port 8080 and `/jenkins/` after sync.