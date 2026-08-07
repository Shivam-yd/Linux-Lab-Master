---
name: Prefixed Jenkins proxy links
description: Why embedded Jenkins console navigation must preserve the configured URL prefix
---

Embedded Jenkins instances use `--prefix=/jenkins`, but some Jenkins pages can emit root-relative links such as `/job/...` instead of `/jenkins/job/...`. The lab proxy must normalize those request paths, redirects, and HTML/JavaScript links through both `/jenkins` and the outer lab proxy path.

**Why:** A page can load successfully while a later action such as Console Output returns Jenkins' own 404 because only the initial prefixed URL was routed correctly.

**How to apply:** When changing the UI proxy, test initial login, job pages, build pages, and console output; preserve handling for prefixed, root-relative, absolute, and relative URLs.