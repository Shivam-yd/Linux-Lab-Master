---
name: WebSocket terminal guest auth
description: How guest (_sid) cookie auth was added to the WS terminal upgrade handler to match HTTP requireAuth
---

The WS terminal upgrade handler (`artifacts/api-server/src/ws/terminal.ts`) must use
the same two-tier identity resolution as the HTTP `requireAuth` middleware:

1. Better Auth session cookie → authenticated user ID
2. Signed guest `_sid` cookie → anonymous student ID

The `_sid` cookie is express/cookie-parser signed format: `s:value.hmac_sha256_base64(secret, value)`.
Verify it using `crypto.createHmac("sha256", secret).update(val).digest("base64")` and
`crypto.timingSafeEqual` for constant-time comparison.

**Why:** Without this, any user who clicked "Continue as Guest" could open a lab
workspace page and reach the start/stop/verify HTTP routes (which use requireAuth and
correctly accept guest cookies) but the WebSocket terminal connection would always be
rejected — a complete functional break for guest users.

**How to apply:** If any new WebSocket endpoint is added that needs auth, copy the
`studentIdFromUpgradeRequest` pattern from terminal.ts. Do NOT add only Better Auth
session check (tier 1) without guest cookie support (tier 2).
