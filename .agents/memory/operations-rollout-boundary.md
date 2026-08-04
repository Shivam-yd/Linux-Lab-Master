---
name: Operations rollout boundary
description: Production ordering and ownership for the operations safety layer.
---

Production rollout must apply the operations schema before publishing the application. The application health endpoint checks the operations tables and certificate privacy column so a missing schema is visible as not ready.

**Why:** The operations endpoints, cleanup telemetry, and certificate privacy behavior depend on database objects that cannot be safely created by application startup.

**How to apply:** Use the supported Replit publish/database workflow for production schema changes, then verify `/api/health` reports `schema: "ok"`. Treat provider-level backups and recovery drills as deployment/platform responsibilities; the app only reports configured backup metadata.