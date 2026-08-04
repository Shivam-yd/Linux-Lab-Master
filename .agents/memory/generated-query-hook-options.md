---
name: Generated query hook options
description: Generated React Query hooks in this workspace require explicit query keys when passing custom options.
---

When gating a generated API hook with options such as `enabled`, include the endpoint's generated query key explicitly.

**Why:** The generated hook typings currently require `queryKey` in the options shape even though the underlying query builder supplies a default.

**How to apply:** Reuse the generated endpoint key for the hook being gated; do not edit generated client files or weaken the generated types.