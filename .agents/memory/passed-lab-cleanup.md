---
name: Passed lab cleanup
description: Lifecycle rule for successful lab verification and sandbox capacity
---

Every fully passed lab must stop and remove its sandbox in the server-side verify flow. The client may update its cached session state and navigate away, but it is not the source of truth for cleanup.

**Why:** Relying on a delayed frontend redirect leaves containers running when the tab is closed or the browser disconnects, consuming the student's active-sandbox limit.

**How to apply:** Preserve progress, ratings, and certificate issuance independently of session cleanup; only stop after all declared verification checks pass.