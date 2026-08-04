---
name: Low-cost lab session recovery
description: Recovery should reuse the existing Docker session and store only a short browser marker.
---

Lab recovery keeps the Docker container and filesystem as the source of truth; the browser stores only the lab ID, selected tab, and timestamp in sessionStorage.

**Why:** Persisting terminal transcripts or keystrokes would add storage cost and privacy surface without preserving the actual lab work.

**How to apply:** Reconnect the WebSocket to the existing running container, clear the marker on stop/reset/expired sessions, and let sessionStorage clear with the browser tab.