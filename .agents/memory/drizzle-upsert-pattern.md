---
name: Drizzle upsert pattern for lab sessions and progress
description: How to correctly upsert lab_sessions and lab_progress rows to avoid race-induced duplicates
---

`lab_sessions` and `lab_progress` both have unique constraints on `(student_id, lab_id)`:
- `uq_lab_sessions_student_lab`
- `uq_lab_progress_student_lab`

All writes to these tables must use Drizzle's `.onConflictDoUpdate()` instead of
a read-then-write pattern. The old `findFirst → insert/update` pattern allowed
concurrent requests to race through the read and create duplicate rows.

**Pattern for sessions:**
```ts
db.insert(labSessionsTable)
  .values({ studentId, labId, status: "starting", ...patch })
  .onConflictDoUpdate({
    target: [labSessionsTable.studentId, labSessionsTable.labId],
    set: { ...patch, updatedAt: new Date() },
  })
  .returning()
```

**Pattern for progress (bestScore must not regress):**
Read bestScore first (one SELECT), compute `Math.max(existing ?? 0, score)`, then upsert.
The read-then-write for bestScore is acceptable (worst case: slightly stale max, not a crash).

**Why:** The former read-then-write caused two concurrent `startSession` calls to both
read "no existing container", then both try `docker.createContainer` with the same name.
The losing call got Docker 409, was caught as `status="error"`, overwriting a running
container's DB state with an error. The in-memory `_startingKeys` Set in manager.ts
prevents this at the app layer; the DB unique constraint prevents it at the DB layer.
