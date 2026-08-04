---
name: Container UI proxy networking
description: How the API should reach service UIs running inside Docker lab containers
---

When the API server and a lab container run in separate containers, proxy requests to the lab container's bridge IP and internal service port. In the k3s deployment, the API pod creates lab containers through the host Docker socket, so the pod may not route to Docker's bridge network; prefer the Kubernetes node IP plus the container's published host port, then fall back to the container IP and local host routes. Do not assume `localhost:<published-host-port>` reaches the Docker host from the API container; in that layout, localhost points back to the API container.

**Why:** The Jenkins UI proxy returned connection errors even though the lab container had a published port. The published host port was valid on the Docker host but not reachable through API-local localhost.

**How to apply:** Inject the node IP into the API pod using the downward API (`status.hostIP`), inspect the running container's network addresses and published binding, and try node host-port, container IP, Docker gateway, then localhost. Service-image labs such as Jenkins need their setup files written before the service reads them; restarting the container once after setup applies init files created after the first start. Always normalize a bare UI proxy request to the service's configured prefix (`/jenkins/`); Jenkins returns 404 for `/` when started with `--prefix=/jenkins`. Log the selected upstream target when connections fail.