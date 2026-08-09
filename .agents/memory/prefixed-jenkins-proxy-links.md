---
name: Prefixed Jenkins proxy links
description: Why embedded Jenkins console navigation must preserve the configured URL prefix
---

Embedded Jenkins instances use `--prefix=/jenkins`, but some Jenkins pages can emit root-relative links such as `/job/...` instead of `/jenkins/job/...`. The lab proxy must normalize those request paths, redirects, HTML/JavaScript links, and CSS `url(/...)` assets through both `/jenkins` and the outer lab proxy path. Already-prefixed `/api/labs/...` URLs must not be rewritten a second time. Do not broadly rewrite relative `href`, `src`, `action`, or `fetch()` values: Jenkins' New Item/configuration pages depend on their original page-relative resolution.

**Why:** A page can load successfully while a later action such as Console Output returns Jenkins' own 404 because only the initial prefixed URL was routed correctly. Conversely, forcing every relative URL to the proxy prefix breaks dynamic Jenkins pages such as New Item and can leave a blank body.

**How to apply:** When changing the UI proxy, test initial login, post-login redirects, job pages, build pages, and console output; preserve handling for prefixed, root-relative, absolute, and relative URLs. Canonicalize a bare `/jenkins` redirect/request to `/jenkins/`, including its query string.