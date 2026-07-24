---
name: Replit PostgreSQL provisioning
description: The imported DevLabMaster app requires Replit's PostgreSQL module for database-backed startup and workflows.
---

The Replit configuration must provision PostgreSQL for this project; keeping `postgresql-16` in the `.replit` modules is part of a valid setup.

**Why:** Better Auth sessions, lab data, progress tracking, and Drizzle schema setup all depend on the runtime-provided `DATABASE_URL`. The app can appear healthy only after that database is available.

**How to apply:** When setting up or repairing this imported project, validate that PostgreSQL provisioning is present before running the schema push and API/web workflow checks.