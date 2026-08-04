---
name: Admin certificate safety
description: Admin certificate refreshes must preserve the same completion validation as student issuance.
---

Admin certificate refresh/reissue actions must call the shared certificate issuance path so an administrator cannot create or extend a certificate for incomplete coursework. Revocation is the separate destructive action.

**Why:** Certificate eligibility is defined by passed labs, so an admin convenience action must not become a completion-check bypass.

**How to apply:** Reuse the existing issuance helper for refresh/backfill flows and keep manual revocation explicit and confirmed.