---
name: Local onboarding preferences
description: The initial learner onboarding intentionally stays lightweight and browser-local.
---

The first-session setup should collect experience, learning goal, and preferred starting track without requiring account-schema or API changes.

**Why:** The product can guide a new learner immediately while keeping onboarding reversible, low-cost, and independent of backend persistence decisions.

**How to apply:** Use local browser state for the initial preference and dismissal flow; introduce server persistence only when cross-device personalization is a confirmed product requirement.