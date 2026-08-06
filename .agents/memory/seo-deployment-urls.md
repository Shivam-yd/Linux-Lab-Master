---
name: SEO deployment URLs
description: Absolute canonical, social, structured-data, and sitemap URLs must follow the verified published domain.
---

Absolute SEO URLs must come from the verified deployment URL. Before publishing, keep runtime canonicals origin-safe and generate the sitemap only when `VITE_SITE_URL` is explicitly configured.

**Why:** The project previously mixed unverified `.app` and `.com` domains, which could create duplicate or incorrect search-engine signals.

**How to apply:** Use the deployment metadata for the live URL; never infer it from a Replit development domain, project name, or an unverified custom domain.