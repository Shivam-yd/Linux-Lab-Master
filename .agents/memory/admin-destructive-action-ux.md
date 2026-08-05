---
name: Admin destructive-action UX
description: Consistent confirmation behavior for destructive actions in the Admin workspace.
---

Admin destructive actions should use the shared custom confirmation modal and the existing toast system. Avoid browser-native confirmation prompts so destructive flows have consistent styling, accessible dialog semantics, and predictable feedback.

**Why:** The Admin workspace has several high-impact actions across independent sections; a single visual and interaction pattern reduces accidental actions and keeps the experience consistent on desktop and mobile.

**How to apply:** When adding or changing an Admin mutation that deletes, revokes, suspends, stops, disables, or removes data, route it through the shared confirmation state before calling the mutation and provide success/error toast feedback.