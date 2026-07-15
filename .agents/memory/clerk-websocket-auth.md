---
name: Clerk auth on raw WebSocket upgrade requests
description: How to authenticate a WS upgrade request with Clerk when it bypasses Express middleware
---

Raw HTTP upgrade requests (e.g. a `ws` server's `on('upgrade')` handler) never run through Express's
middleware chain, so `@clerk/express`'s `getAuth(req)` (which reads `res.locals` set by `clerkMiddleware()`)
is unavailable there.

**Fix:** use `clerkClient.authenticateRequest(request)` from `@clerk/express` directly. Build a Fetch API
`Request` from the raw `IncomingMessage` (construct a `Headers` object from `req.headers`, resolve the URL
from `req.url` + `req.headers.host`), pass it to `authenticateRequest`, then call `state.toAuth()?.userId`.
No explicit secret/publishable key args needed — `clerkClient` already has them bound from env vars.

**Why:** Clerk's Express integration is designed around `getAuth(req)` needing `clerkMiddleware()` to have
run first on that exact request object; WS upgrades never get that treatment since `ws`'s upgrade handler
receives the raw Node `http.IncomingMessage`, not an Express-augmented request.

**How to apply:** Any time a project adds a raw WebSocket/upgrade handler that needs to identify the Clerk
user (e.g. a terminal/streaming feature), authenticate it this way instead of trying to thread Express
middleware onto the upgrade path.
