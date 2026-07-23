---
name: Plan access and trials
description: Server-side lab-track gating and the current DevOps Pro trial policy.
---

Plan access is enforced at sandbox boundaries, not at lab metadata reads: authenticated users need to see locked lab details so the UI can explain the upgrade path. Linux is included in Linux Starter; Docker, Terraform, Jenkins, and Git require DevOps Pro.

**Why:** Blocking metadata made the existing workspace upgrade screen impossible to render, while client-only locks were bypassable through session and terminal endpoints.

**How to apply:** Reuse the shared access helper for any new session, verification, or realtime sandbox endpoint. Preserve unrestricted stop-session behavior so users can terminate containers after a downgrade.

DevOps Pro selected through the account plan flow starts a 14-day trial. Provider-backed Pro subscriptions and non-expiring admin overrides remain active; an expired unpaid trial falls back to Linux Starter.

**Why:** Trial access was needed without inventing payment-provider behavior, and the plan state must expire server-side rather than relying on UI messaging.

**How to apply:** Keep trial expiry checks in both effective-plan and has-plan-access queries. Add real billing-provider renewal handling only when a provider is integrated.