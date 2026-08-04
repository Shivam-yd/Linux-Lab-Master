---
name: Low-cost lab session recovery
description: Recovery should reuse the existing Docker session and store only a short browser marker.
---

Lab recovery keeps the Docker container and filesystem as the source of truth; the browser stores only the lab ID, selected tab, and timestamp in sessionStorage.

**Why:** Persisting terminal transcripts or keystrokes would add storage cost and privacy surface without preserving the actual lab work.

**How to apply:** Reconnect the WebSocket to the existing running container, clear the marker on stop/reset/expired sessions, and let sessionStorage clear with the browser tab.

Use dynamic viewport units (`100dvh`) for the lab shell because mobile browser chrome makes fixed `100vh` layouts clip controls when the workspace hides overflow.

**Why:** The lab workspace is a fixed-height, split-pane layout; the visible viewport can be shorter than the legacy CSS viewport on mobile.

**How to apply:** Keep the shell and loading state on `100dvh`; retain internal panel scrolling rather than allowing the whole lab page to grow.