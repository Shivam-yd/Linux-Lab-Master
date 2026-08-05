---
name: Catalog counts
description: How the displayed lab totals relate to repository YAML definitions and built-in labs.
---

The public catalog total is the synchronized YAML lab count plus the built-in
Linux lab count. Repository documentation should state both when describing
the catalog, because the YAML directory alone does not represent every lab
shown to learners.

**Why:** The landing page, README, and checkout copy drifted when they used
different historical totals.

**How to apply:** When labs are added or removed, recalculate both the YAML
track counts and built-in count, then update the README, plan copy, and any
static fallback text together. Prefer the runtime `/api/stats` result for the
public total.