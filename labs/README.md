# Linux Lab Master — Lab Definitions

This folder contains **YAML lab definitions** that the Linux Labs platform
fetches automatically once an hour.  You can also trigger an immediate
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

## ⚠️ Sandbox has NO internet access — read this before writing any script

Every lab runs in a Docker container in the Replit environment, and **that
container has no outbound internet/DNS access**. This means:

- `apt-get`, `apk add`, `pip install`, `npm install`, `curl <url>`,
  `wget <url>`, `git clone` — **none of these work at runtime**, even with
  `-qq` or `--quiet` flags. They will hang or fail silently, and any lab that
  depends on them will look "broken" to students no matter what they do.
- `docker pull` for the `image:` field **does** work (images are pulled once
  ahead of time), so the fix is always to **choose or build an image that
  already contains everything the lab needs** — never to install things
  inside `setupScript`.
- This bit a real lab before ("Cron & Task Scheduling" used `ubuntu:24.04` +
  `apt-get install -y cron at`, which silently failed, so `cron`/`at` were
  never present and every check failed). Don't repeat that mistake.

### How to satisfy a lab's tool requirements without installing anything

1. **Prefer official/community images that already bundle the tool.**
   Examples already used in this repo: `hashicorp/terraform:1.9` (Terraform
   preinstalled), `rastasheep/ubuntu-sshd:18.04` (sshd preinstalled).
2. **Prefer Alpine + BusyBox for common Linux utilities.** BusyBox (built
   into `alpine:latest`) already ships `crond`/`crontab`, `vi`, `ps`,
   `grep`, `find`, `awk`, `sed`, networking basics, etc. Run
   `docker run --rm alpine:latest busybox --list` to see the full applet
   list before assuming a tool is missing.
3. **If a required tool truly isn't available anywhere,** write a small
   POSIX-`sh` shim script in `setupScript` that fakes the minimum behavior
   the lab's tasks need (see `labs/linux/03-cron-scheduling.yaml`'s `at`
   shim for a worked example) — do not fall back to a package manager.
4. **Before writing the real `setupScript`/`verifyScript`,** manually pull
   the candidate image and exec into it to confirm the commands you plan to
   use actually exist:
   ```bash
   docker pull <image>
   docker run --rm <image> sh -c 'which <tool1> <tool2>; cat /etc/os-release'
   ```
   Do this check for every tool your lab's instructions/hints tell students
   to run — not just the "main" one. (For the cron lab, `crond` existed but
   `at` didn't; that mismatch is exactly what breaks a lab.)
5. **Test the full lab flow end-to-end before publishing** — actually
   `docker run` the chosen image, execute your `setupScript`, perform the
   actions a student would perform, then execute your `verifyScript` and
   confirm every `CHECK:` line comes back `PASS`. Don't just read the
   scripts and assume they'll work.

---

## Lab YAML format

Copy `labs/linux/01-file-permissions.yaml` as a starting point.  Required
fields are marked with ✱.

| Field | Type | Notes |
|---|---|---|
| `id` ✱ | string | Unique across all labs. Use kebab-case. |
| `title` ✱ | string | Shown in the catalog |
| `track` ✱ | string | `linux` or `terraform` (or any new track) |
| `level` ✱ | number | `1`–`5`. In practice `1` = Foundation, `2` = Intermediate, `3+` = Advanced |
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
| `setupScript` ✱ | string | Shell script run as root when the container starts. The platform runs it as `<shell> -lc <script>` using the `shell` field below — match your syntax to your image's real shell |
| `verifyScript` ✱ | string | Shell script that prints `CHECK:<taskId>:PASS\|FAIL:<msg>` per task. Same shell rules as `setupScript` |
| `entrypoint` | string[] | Override container entrypoint (needed for images like `hashicorp/terraform` whose default entrypoint is not a shell) |
| `shell` | `"bash"` \| `"sh"` | **Required if you use any bash-specific syntax.** The platform uses this field to invoke *both* `setupScript` and `verifyScript` (as `<shell> -lc <script>`). Mismatch between this field and your actual image shell = silent FAIL on every check. See the shell reference table below. |
| `hints` | string[] | Progressive hints shown one at a time when student is stuck |

### Shell reference — know before you write a single line of script

The `shell` field controls how the platform runs **both** `setupScript` and
`verifyScript`. Getting it wrong causes every verify check to silently fail
with no visible error to the student.

| Image | `/bin/sh` is | Supports `[[ ]]`? | Use `shell:` |
|---|---|---|---|
| `ubuntu:24.04` | **dash** | ❌ No — `[[: not found` | `"bash"` (bash is pre-installed) |
| `alpine:latest` | **BusyBox ash** | ✅ Yes | `"sh"` |
| `hashicorp/terraform:1.9` | **BusyBox ash** (Alpine-based) | ✅ Yes | `"sh"` |
| `localstack/localstack:latest` | **dash** (Ubuntu-based) | ❌ No | `"bash"` (bash is pre-installed) |
| Any other Ubuntu-based image | **dash** | ❌ No | `"bash"` if bash is present |
| Any other Alpine-based image | **BusyBox ash** | ✅ Yes | `"sh"` |

**Quick test** — run this before writing any scripts for a new image:
```bash
docker run --rm <image> sh -lc 'if [[ 1 == 1 ]]; then echo ok; fi'
```
- Prints `ok` → ash or bash, `[[ ]]` works, `shell: "sh"` is fine.
- Prints `[[: not found` → dash, **do not use `[[ ]]`** — either set `shell: "bash"` (if bash is installed in the image) or rewrite all scripts with POSIX `[ ]`.

### verifyScript contract

Each check line must follow this exact format:

```
CHECK:<taskId>:PASS:<message>
CHECK:<taskId>:FAIL:<reason>
```

- `taskId` must **exactly match** one of the `tasks[].id` values in the same
  file — the parser does a strict string comparison, no fuzzy matching.
- Every task must have **both** a `PASS` path and a `FAIL` path — a task
  that only ever emits one will always report that result regardless of what
  the student does.

---

## Creating a new lab — step by step

### Step 1 — Pick a topic and track

Decide what the student will learn and which track it belongs to, then pick
an `image` that already contains every tool the lab needs (see the
no-internet warning above — never plan on installing anything at runtime):

| Track | Image to use | When |
|---|---|---|
| `linux` | `alpine:latest` (preferred — BusyBox covers most core-utils/cron needs) or `ubuntu:24.04` (only if you specifically need a tool that requires a glibc environment) | Shell, files, users, networking, scripting |
| `terraform` | `hashicorp/terraform:1.9` | IaC, providers, state, modules |

If the topic needs a tool that isn't in either base image, find a
pre-built image that bundles it (e.g. `rastasheep/ubuntu-sshd:18.04` for
SSH) — don't reach for `ubuntu:24.04` + `apt-get install` by default.

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
- IDs must be unique within the lab and match **exactly** what `verifyScript` emits in its `CHECK:` lines.
- Descriptions are shown to the student — write them as instructions, not test names.

---

### Step 3 — Write the setupScript

`setupScript` runs as root the moment the student clicks **"Deploy Sandbox"**.  Use it to seed the lab's starting state.

```yaml
image: "alpine:latest"
shell: "sh"
setupScript: |
  # No apt-get/apk here — the sandbox has no internet access.
  # alpine already ships BusyBox crond, so just create the starting state
  # and start the daemon.
  mkdir -p /usr/local/bin
  echo "# add your backup logic here" > /usr/local/bin/backup.sh
  chmod +x /usr/local/bin/backup.sh
  crond
```

Tips:
- Never call `apt-get`/`apk`/`pip`/`npm install`/`curl <url>`/`wget <url>` here — there's no network access at runtime; see the warning at the top of this file.
- Pick an `image` that already has what you need instead of installing anything.
- The script must be idempotent (re-running it should not break anything).
- Always set `shell:` before writing the script — it controls which interpreter the platform uses to run this script.

---

### Step 4 — Write the verifyScript

`verifyScript` runs every time the student clicks **"Check my work"**.  For each task, print exactly one `CHECK:` line.

```yaml
verifyScript: |
  # CHECK: verify-script-exists
  if [ -f /usr/local/bin/backup.sh ] && [ -x /usr/local/bin/backup.sh ]; then
    echo "CHECK:verify-script-exists:PASS:backup.sh exists and is executable"
  else
    echo "CHECK:verify-script-exists:FAIL:backup.sh not found or not executable in /usr/local/bin"
  fi

  # CHECK: create-cronjob
  if crontab -l 2>/dev/null | grep -q "0 2 \* \* \*.*backup"; then
    echo "CHECK:create-cronjob:PASS:Cron job found for 2 AM"
  else
    echo "CHECK:create-cronjob:FAIL:No matching cron entry found — run 'crontab -e' and add the job"
  fi
```

Rules:
- Every `CHECK:` line format: `CHECK:<taskId>:PASS|FAIL:<human message>`
- Every `taskId` in a `CHECK:` line must **exactly match** one of the `tasks[].id`
  values in the same file — the parser does a strict string comparison.
- Every task must emit **both** a `PASS` path and a `FAIL` path — a task with
  only one path will always report the same result regardless of what the student does.
- One `CHECK:` line per task is enough — the parser uses the first match.
- The script must finish in **under 10 seconds**.
- Must be idempotent — it can be run many times without side effects.
- **Match your syntax to your image's actual shell** — see the shell reference
  table above. The most common mistake: writing `[[ ]]` for a `ubuntu:24.04` lab
  with `shell: "sh"`. Ubuntu's `/bin/sh` is dash, which silently rejects `[[`,
  causing every check to output a wrong value and report FAIL even when the
  student's work is correct. Either set `shell: "bash"` or rewrite with `[ ]`.

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

The `instructions` field is full Markdown displayed in the lab workspace.
Every lab must follow this structure — it matches what students see in the
rendered UI and keeps the experience consistent across all tracks.

```yaml
instructions: |
  ## Cron Jobs & Automation

  **Scenario**
  Your ops team needs to back up the database every night at 2 AM without
  anyone manually triggering it. Right now nothing is scheduled — every
  backup is done by hand. Your job is to automate it with cron so it runs
  unattended from tonight onwards.

  **Your task:** create a backup script and schedule it to run automatically
  every day at 2 AM using cron.

  No text editor is installed — create or edit files with shell redirection:
  `echo "content" > file` or `cat > file <<'EOF' ... EOF`

  **What You'll Deliver**
  - `/usr/local/bin/backup.sh` created and made executable
  - A cron job scheduled to run it every day at 2 AM

  ## Steps

  1. Create the backup script:
     `echo '#!/bin/sh' > /usr/local/bin/backup.sh && echo 'echo backup ran' >> /usr/local/bin/backup.sh`
  2. Make it executable: `chmod +x /usr/local/bin/backup.sh`
  3. Add the cron job: `echo "0 2 * * * /usr/local/bin/backup.sh" | crontab -`
  4. Verify the schedule: `crontab -l`
```

**How the UI renders this structure**

| Section | What it becomes in the UI |
|---|---|
| `## Title` | Page heading |
| `**Scenario**` | Narrative context block |
| `**Your task:**` | Single-sentence goal |
| Tool/editor caveat line | Plain note below the task |
| `**What You'll Deliver**` | Bullet list of deliverables |
| `## Steps` | Extracted and hidden behind a **"Reveal Step-by-Step Guide"** button — students click to expand it only if stuck |

> **Important:** The `## Steps` heading is magic — the workspace parser
> splits it out of the main instructions and renders it as a collapsible
> panel. Keep it as a level-2 heading (`##`) and do not rename it.
> Everything before `## Steps` is always visible; everything under it is
> hidden until the student asks for help.

**Guidelines for each section**

- **Scenario** — 2–4 sentences. Write it as a real-world incident or
  task, not a tutorial intro. The student should know *why* they're doing
  this before they read the steps.
- **Your task** — one sentence summarising the entire goal. Make it
  concrete: name the files, commands, or end-states expected.
- **Caveat line** — `alpine`-based images (`alpine:latest`, `alpine/git:latest`,
  `hashicorp/terraform:1.9`) ship BusyBox `vi`, so students actually have an
  editor — skip the "No text editor is installed" note for labs using those
  images (a quick `which vi vim nano` in the target image confirms this).
  `ubuntu:24.04` and `localstack/localstack:latest` have no editor at all —
  keep the caveat for labs using those images, and for any other image once
  you've confirmed it lacks one the same way.
- **What You'll Deliver** — bullet list that mirrors the `tasks[]` entries.
  One bullet per task, written as a deliverable ("X created", "Y configured"),
  not as an action ("Create X", "Configure Y").
- **## Steps** — numbered list of exact commands. Be specific: show the
  full command the student should run, not a paraphrase. This section is
  only revealed on request, so it can be as detailed as needed without
  cluttering the main view.

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

### Step 8 — Pre-publish checklist

Run through this before every `git push`. It takes 5 minutes and prevents broken labs reaching students.

**Structure checks**

- [ ] Every field marked ✱ in the format table is present and non-empty
- [ ] `id` is unique — check it doesn't already appear in any other `.yaml` file in `labs/`
- [ ] Every `tasks[].id` appears as `CHECK:<id>:PASS:` **and** `CHECK:<id>:FAIL:` in `verifyScript`
- [ ] No `CHECK:` line in `verifyScript` references an ID that isn't in `tasks[]`

**Shell checks**

- [ ] `shell:` is set and matches what the image actually provides (see the shell reference table)
- [ ] Run the quick test against your image: `docker run --rm <image> sh -lc 'if [[ 1 == 1 ]]; then echo ok; fi'`
  - Got `ok` → `[[ ]]` is safe; your `shell:` choice is consistent
  - Got `[[: not found` → you have dash; use `[ ]` or switch to `shell: "bash"`

**Live end-to-end test**

```bash
# 1. Spin up a container (using the entrypoint override if needed)
docker run -d --name lab-test <image> sleep 300

# 2. Run the setupScript
docker exec lab-test <shell> -lc "$(grep -A9999 'setupScript:' your-lab.yaml | tail -n +2 | sed 's/^  //')"

# 3. Simulate the student's work (perform the tasks the lab asks for)

# 4. Run the verifyScript — every CHECK line must say PASS
docker exec lab-test <shell> -lc "$(grep -A9999 'verifyScript:' your-lab.yaml | tail -n +2 | sed 's/^  //')"

# 5. Clean up
docker rm -f lab-test
```

Alternatively, start the actual app locally, open the lab, complete it yourself,
and click "Check my work" — all tasks must turn green.

**No-internet checks**

- [ ] `setupScript` contains no `apt-get`, `apk`, `pip`, `npm install`, `curl <url>`, `wget <url>`, or `git clone`
- [ ] Every tool used in `setupScript`/`verifyScript`/`instructions` is present in the chosen image (confirmed with `docker run --rm <image> which <tool>`)

---

### Step 9 — Publish

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
- The `setupScript` runs once when the student clicks "Deploy Sandbox". There
  is no network access, so it can never call a package manager — pick an
  `image` that already has what you need, or fake missing tools with a small
  shell shim (see the warning near the top of this file).
- The `verifyScript` is run every time the student clicks "Check".  It must be
  idempotent and complete in under 10 seconds.
- If you update a lab's YAML, the app detects the changed GitHub blob SHA and
  re-fetches it automatically.  Students who already have a session running
  will see the updated instructions on next page load; their running container
  is not restarted.
