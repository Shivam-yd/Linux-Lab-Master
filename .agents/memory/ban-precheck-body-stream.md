---
name: Ban pre-check body stream bug
description: The original ban pre-check in app.ts consumed the request body stream before Better Auth, then tried to push it back with req.unshift(). This caused "[body] Invalid input: expected object, received undefined" on sign-in in self-hosted deployments.
---

# Ban pre-check body stream bug

## Rule
Never consume a Node.js `IncomingMessage` body stream before `toNodeHandler(auth)` and try to push it back with `req.unshift()`. After the stream emits `end`, `unshift` puts data back in the buffer but the stream is still in ended state — downstream handlers (Better Auth's toNodeHandler) attach their own body listeners after `next()` and receive nothing, causing body = undefined.

**Why:** Node.js Readable streams that have emitted `end` won't re-emit `end` after `unshift`. Better Auth's body parsing waits for `end` to assemble the body — if it never fires, the body stays undefined, Zod validation fails with "[body] Invalid input: expected object, received undefined".

**How to apply:** Move any logic that needs the sign-in request body (e.g. banned-user check) into a Better Auth hook instead:
- `databaseHooks.session.create.before` — fires after password verification, before session write; has `session.userId` available to look up the user.
- Do NOT intercept at the Express middleware layer by reading the raw stream.
