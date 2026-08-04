---
name: Admin route ordering
description: Admin routes must be mounted before the auth-gated labs router.
---

Mount the `/admin` router before the root-mounted labs router.

**Why:** The labs router applies `requireAuth` to every route after its public handlers, so it can intercept paths such as `/admin/check` before the admin router and turn an anonymous access probe into a 401.

**How to apply:** Keep public admin access checks before auth-gated routers, and place any new `/admin/*` endpoints in the admin router rather than relying on later route registration.