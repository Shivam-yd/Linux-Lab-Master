# Linux Lab Master — Lab Definitions

This folder contains **YAML lab definitions** that the Linux Labs platform
fetches automatically every 10 minutes.  You can also trigger an immediate
sync with the **"Fetch Labs"** button in the app.

---

## Folder structure

```
labs/
  linux/          ← Linux track labs
    01-file-permissions.yaml
    02-process-management.yaml
    ...
  terraform/      ← Terraform track labs
    01-remote-state.yaml
    ...
```

Sub-folders are just for organisation — the app recursively picks up every
`*.yaml` file anywhere under `labs/`.

---

## Lab YAML format

Copy `labs/linux/01-file-permissions.yaml` as a starting point.  Required
fields are marked with ✱.

| Field | Type | Notes |
|---|---|---|
| `id` ✱ | string | Unique across all labs. Use kebab-case. |
| `title` ✱ | string | Shown in the catalog |
| `track` ✱ | string | `linux` or `terraform` (or any new track) |
| `level` ✱ | number | `1` = Foundation, `2` = Intermediate, `3` = Advanced |
| `category` ✱ | string | Sidebar grouping label |
| `difficulty` ✱ | string | `beginner` / `intermediate` / `advanced` |
| `summary` ✱ | string | One-line description |
| `estimatedMinutes` ✱ | number | Shown on lab card |
| `order` ✱ | number | Lower = appears first. Use gaps (100, 200…) for easy insertion |
| `objectives` ✱ | string[] | Bullet list shown before starting |
| `instructions` ✱ | string | Full Markdown shown in the lab workspace |
| `tasks` ✱ | object[] | `{ id, description }` — each maps to one verify check |
| `image` ✱ | string | Docker image (`ubuntu:24.04`, `hashicorp/terraform:1.9`, …) |
| `terminals` ✱ | object[] | `{ name, user, cwd }` — one entry per terminal tab |
| `setupScript` ✱ | string | Bash run as root when the container starts |
| `verifyScript` ✱ | string | Bash that prints `CHECK:<taskId>:PASS\|FAIL:<msg>` per task |
| `entrypoint` | string[] | Override container entrypoint (needed for Terraform image) |
| `shell` | string | `bash` or `sh` (default: `sh`) |
| `hints` | string[] | Progressive hints shown one at a time when student is stuck |

### verifyScript contract

Each check line must follow this exact format:

```
CHECK:<taskId>:PASS:<message>
CHECK:<taskId>:FAIL:<reason>
```

`taskId` must match one of the `tasks[].id` values in the same file.

---

## Publishing a new lab

1. Create a `.yaml` file in `labs/linux/` or `labs/terraform/`
2. `git add labs/yourlab.yaml && git commit -m "add: your lab title"`
3. `git push`
4. The app fetches it within **10 minutes** — or click **"Fetch Labs"** for instant sync.

---

## Tips

- `order` values don't need to be contiguous.  Use `100, 200, 300…` so you can
  insert labs between existing ones without renumbering.
- The `setupScript` runs once when the student clicks "Deploy Sandbox".  Keep
  it fast — avoid large `apt-get` installs if possible, or pre-bake a custom
  Docker image.
- The `verifyScript` is run every time the student clicks "Check".  It must be
  idempotent and complete in under 10 seconds.
- If you update a lab's YAML, the app detects the changed GitHub blob SHA and
  re-fetches it automatically.  Students who already have a session running
  will see the updated instructions on next page load; their running container
  is not restarted.
