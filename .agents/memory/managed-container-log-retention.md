---
name: Managed container log retention
description: Disk protection policy for Docker logs emitted by lab containers
---

Managed lab containers must use explicit Docker log rotation rather than relying on the host daemon's unlimited defaults. The outer container is capped at 10 MB per file with three files retained; Docker's json-file rotation is bounded but not compressed. Docker-in-Docker workloads are a separate boundary.

**Why:** service labs such as Jenkins can emit substantial stdout/stderr during startup or normal operation, and the host daemon currently uses `json-file`.

**How to apply:** preserve this policy on every managed `createContainer` call. If inner DinD containers become persistent or long-lived, configure rotation in their inner `dockerd` separately; the outer policy cannot cap those nested daemon logs.