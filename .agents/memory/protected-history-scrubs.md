---
name: Protected history scrubs
description: Handling sensitive artifacts that must be removed from a protected GitHub branch
---

When a sensitive file has been committed, scrub it from the local branch and all local refs, then require an authorized GitHub administrator to force-update a protected remote branch. A normal push or pull request does not remove the artifact from reachable remote history.

**Why:** branch protection can reject the required non-fast-forward update even when the local history is clean.

**How to apply:** keep the workspace scrubbed and ignore future artifact patterns, then coordinate a protected-branch history rewrite and credential/session rotation before treating the remote repository as clean.