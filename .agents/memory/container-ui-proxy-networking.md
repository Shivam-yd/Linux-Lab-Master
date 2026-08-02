---
name: Container UI proxy networking
description: How the API should reach service UIs running inside Docker lab containers
---

When the API server and a lab container run in separate containers, proxy requests to the lab container's bridge IP and internal service port. Do not assume `localhost:<published-host-port>` reaches the Docker host from the API container; in that layout, localhost points back to the API container.

**Why:** The Jenkins UI proxy returned connection errors even though the lab container had a published port. The published host port was valid on the Docker host but not reachable through API-local localhost.

**How to apply:** Inspect the running container's network addresses and prefer a non-empty container IP plus the declared service port. Keep the published-port localhost path only as a local/dev fallback, and log the selected upstream target when connections fail.