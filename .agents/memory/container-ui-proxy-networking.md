---
name: Container UI proxy networking
description: How the API should reach service UIs running inside Docker lab containers
---

When the API server and a lab container run in separate containers, proxy requests to the lab container's bridge IP and internal service port. In the k3s deployment, the API pod creates lab containers through the host Docker socket, so the pod may not route to Docker's bridge network; prefer the Kubernetes node IP plus the container's published host port, then fall back to the container IP and local host routes. Do not assume `localhost:<published-host-port>` reaches the Docker host from the API container; in that layout, localhost points back to the API container.

**Why:** The Jenkins UI proxy returned connection errors even though the lab container had a published port. The published host port was valid on the Docker host but not reachable through API-local localhost.

**How to apply:** Inject the node IP into the API pod using the downward API (`status.hostIP`), inspect the running container's network addresses and published binding, and try node host-port, container IP, Docker gateway, then localhost. Service-image labs such as Jenkins need their setup files written before the service reads them; restarting the container once after setup applies init files created after the first start. Always normalize a bare UI proxy request to the service's configured prefix (`/jenkins/`); Jenkins returns 404 for `/` when started with `--prefix=/jenkins`. With anonymous reads disabled, use `/jenkins/login` as the iframe/readiness entry point; the dashboard itself correctly returns 403 until the user signs in. Jenkins 2.541.3 still bundles the Freestyle `hudson/tasks/Shell` descriptor, so “Execute shell” is core functionality and does not need a plugin. Scope explicit Markdown colors to execution-step cards because typography defaults can hide emphasis and list content in dark mode. Log the selected upstream target when connections fail.

Jenkins 2.541.3 dynamic configuration controls use `org/kohsuke/stapler/bind.js`: the browser POSTs a JSON method array to a session-bound `/$stapler/bound/<id>/` URL with the custom `application/x-stapler-method-invocation` content type and crumb headers. A UI proxy must capture and forward that raw body unchanged; parsing only JSON or URL-encoded forms makes widgets such as Freestyle “Execute shell” render without their fields.

Jenkins service containers can return a valid login page before `init.groovy.d` finishes creating the configured account after the setup restart. Service readiness must wait on an initialization marker created at the end of the Groovy script, not only on HTTP 200 from `/jenkins/login`.

The API must also keep a service session in `starting` until both the initialization marker and the service's HTTP entry point are ready. The UI proxy should reject non-running session rows before inspecting or forwarding to the container.

Execution-step Markdown should avoid the Tailwind Typography `prose` class entirely. Even scoped color overrides can leave individual emphasis nodes unreadable because Typography injects its own prose color variables; a small card-local renderer is more reliable.