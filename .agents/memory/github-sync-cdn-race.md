---
name: GitHub sync CDN race condition
description: The lab sync uses file.sha from GitHub API for change detection, but downloads content from a CDN download_url that can serve stale content briefly after a push.
---

# GitHub sync CDN race

## The rule
After pushing a lab YAML fix to GitHub, the sync may record the **new SHA with old content** if the CDN download_url hasn't propagated yet. Subsequent syncs then see matching SHAs and skip the file — leaving stale definitions in the DB indefinitely.

**Why:** `runSync` in `github-sync.ts` compares `file.sha` (from GitHub Contents API, which updates immediately) against the DB `sha` column. If they differ, it downloads the file from `file.download_url` (GitHub CDN, which has a brief cache lag). If that download serves old bytes, the DB stores: new SHA + old definition. Next sync: SHA already matches → skip.

**How to apply:** Whenever a lab fix is pushed to GitHub and synced manually:
1. Wait ~60 seconds before triggering sync (CDN propagation), OR
2. After sync, query the DB to confirm the definition actually contains the fix:
   `SELECT definition->>'setupScript' FROM remote_labs WHERE id = '...'`
3. If stale: `UPDATE remote_labs SET sha = '' WHERE id = '...'` to force re-fetch, then sync again.

A more permanent fix would be to verify content hash against the blob SHA after download, or use the Git Trees API (which returns raw content, not CDN URLs) instead of Contents API.
