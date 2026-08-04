---
name: Admin certificate safety
description: Admin certificate refreshes must preserve the same completion validation as student issuance.
---

Admin certificate refresh/reissue actions must call the shared certificate issuance path so an administrator cannot create or extend a certificate for incomplete coursework. Revocation is the separate destructive action.

**Why:** Certificate eligibility is defined by passed labs, so an admin convenience action must not become a completion-check bypass.

**How to apply:** Reuse the existing issuance helper for refresh/backfill flows and keep manual revocation explicit and confirmed.

Legacy certificate rows may have a missing student link; recover them only when the deterministic certificate ID uniquely maps to a current account, then still run the shared completion validation.

**Why:** Older backfill code could create an orphan record, but refresh must never guess an account or bypass eligibility checks.

**How to apply:** Include `studentId` in every backfill/upsert and use the deterministic ID as the only safe legacy-link lookup.