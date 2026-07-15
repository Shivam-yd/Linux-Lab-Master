---
name: Ponytail coding style
description: User wants all code written in ponytail style — lazy senior dev, minimum code that works.
---

# Ponytail coding style

User preference: write all code following the ponytail ruleset (https://github.com/DietrichGebert/ponytail).

**The ladder (run top-to-bottom before writing anything):**
1. Does this need to be built at all? (YAGNI)
2. Already exists in this codebase? Reuse it.
3. Standard library covers it? Use it.
4. Native platform feature covers it? Use it.
5. Already-installed dependency solves it? Use it.
6. Can it be one line? Make it one line.
7. Only then: write the minimum code that works.

**Rules:**
- No abstractions not explicitly requested.
- No new dependency if avoidable.
- No boilerplate nobody asked for.
- Deletion over addition. Boring over clever. Fewest files possible.
- Shortest working diff wins — but only after understanding the problem fully.
- Bug fix = root cause, not symptom. Fix the shared function once, not each caller.
- Mark deliberate simplifications with `ponytail:` comment naming the ceiling and upgrade path.

**Not lazy about:** input validation at trust boundaries, error handling that prevents data loss, security, accessibility, anything explicitly requested. Non-trivial logic leaves ONE small runnable check (assert/self-check or one small test, no frameworks).

**Why:** user explicitly requested this style on 2026-07-15.
