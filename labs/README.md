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

## Creating a new lab — step by step

### Step 1 — Pick a topic and track

Decide what the student will learn and which track it belongs to:

| Track | Image to use | When |
|---|---|---|
| `linux` | `ubuntu:24.04` | Shell, files, users, networking, scripting |
| `terraform` | `hashicorp/terraform:1.9` | IaC, providers, state, modules |

Give the lab a short **kebab-case ID** that is unique across all labs, e.g. `linux-cron-jobs` or `terraform-data-sources`.

---

### Step 2 — Define the tasks

Tasks are the checkable objectives — each one becomes a row in the "Check my work" panel.  Write them before anything else; they drive everything downstream.

```yaml
tasks:
  - id: "create-cronjob"
    description: "Add a cron job that runs /usr/local/bin/backup.sh every day at 2 AM"
  - id: "verify-script-exists"
    description: "Create /usr/local/bin/backup.sh and make it executable"
```

Rules:
- IDs must be unique within the lab and match exactly what `verifyScript` emits.
- Descriptions are shown to the student — write them as instructions, not test names.

---

### Step 3 — Write the setupScript

`setupScript` runs as root the moment the student clicks **"Deploy Sandbox"**.  Use it to seed the lab's starting state.

```yaml
setupScript: |
  apt-get update -qq && apt-get install -y -qq cron
  # Create a placeholder so the student knows where to start
  mkdir -p /usr/local/bin
  echo "# add your backup logic here" > /usr/local/bin/backup.sh
  systemctl enable cron && systemctl start cron
```

Tips:
- Redirect `apt-get` output with `-qq` to keep startup fast and quiet.
- Avoid downloading large files here — use a pre-pulled Docker image instead.
- The script must be idempotent (re-running it should not break anything).

---

### Step 4 — Write the verifyScript

`verifyScript` runs every time the student clicks **"Check my work"**.  For each task, print exactly one `CHECK:` line.

```yaml
verifyScript: |
  # CHECK: verify-script-exists
  if [[ -f /usr/local/bin/backup.sh && -x /usr/local/bin/backup.sh ]]; then
    echo "CHECK:verify-script-exists:PASS:backup.sh exists and is executable"
  else
    echo "CHECK:verify-script-exists:FAIL:backup.sh not found or not executable in /usr/local/bin"
  fi

  # CHECK: create-cronjob
  if crontab -l 2>/dev/null | grep -q "2 \* \* \* backup.sh\|0 2 \* \* \*.*backup"; then
    echo "CHECK:create-cronjob:PASS:Cron job found for 2 AM"
  else
    echo "CHECK:create-cronjob:FAIL:No matching cron entry found — run 'crontab -e' and add the job"
  fi
```

Rules:
- Every `CHECK:` line format: `CHECK:<taskId>:PASS|FAIL:<human message>`
- One line per task — the first match wins; extras are ignored.
- The script must finish in **under 10 seconds**.
- Must be idempotent — it can be run many times without side effects.

---

### Step 5 — Add hints

Hints are revealed one at a time when a student is stuck.  Order them from vague to specific.

```yaml
hints:
  - "Look at the `crontab` man page — specifically the time-field syntax."
  - "The cron time field for 2 AM daily is: `0 2 * * *`"
  - "Run `crontab -e` and add: `0 2 * * * /usr/local/bin/backup.sh`"
```

---

### Step 6 — Write the instructions (Markdown)

The `instructions` field is full Markdown displayed in the lab workspace.  A good structure:

```yaml
instructions: |
  ## Cron Jobs & Automation

  A short paragraph explaining what cron is and why it matters.

  ### What you need to do

  1. Create `/usr/local/bin/backup.sh` and make it executable.
  2. Schedule it to run every day at 2 AM using `crontab -e`.

  ### Reference

  | Field | Meaning |
  |---|---|
  | `0 2 * * *` | At 02:00, every day |

  ```bash
  # Example crontab entry
  0 2 * * * /usr/local/bin/backup.sh
  ```
```

---

### Step 7 — Fill in the metadata

```yaml
id: "linux-cron-jobs"
title: "Cron Jobs & Automation"
track: "linux"
level: 2                        # 1 = Foundation, 2 = Intermediate, 3 = Advanced
category: "Automation"
difficulty: "intermediate"      # beginner | intermediate | advanced
summary: "Schedule recurring tasks with cron and write a backup script."
estimatedMinutes: 30
order: 210                      # pick a number that fits between existing labs
```

---

### Step 8 — Publish

```bash
git add labs/linux/linux-cron-jobs.yaml
git commit -m "add: Cron Jobs & Automation"
git push
```

The app picks it up within **10 minutes**, or click **"Fetch Labs"** in the catalog for an instant sync.

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
