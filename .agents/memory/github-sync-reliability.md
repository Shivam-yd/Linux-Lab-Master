---
name: GitHub sync reliability
description: Manual lab syncs must return the completed result instead of relying on a separately polled status row.
---

Manual sync should await the shared sync operation, return its result and real error message, and validate each remote file once.

**Why:** A background POST plus status polling can read stale results or hide the actual failure, while sequential duplicate downloads make a 74-file sync unnecessarily slow.

**How to apply:** Keep the manual endpoint synchronous from the caller's perspective, preserve the automatic background trigger, and reuse one validated-file collection for upserts and pruning.