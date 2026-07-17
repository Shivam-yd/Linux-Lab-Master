---
name: Lab verify script audit patterns
description: Known false-positive bugs in lab verifyScripts and how to fix them. Apply these patterns when writing or reviewing any new lab.
---

## Rule 1 — Never use `git show` to test file existence

**Bad:** `git show HEAD -- NOTES.md >/dev/null 2>&1` — exits 0 even when the file was NEVER in that commit (empty diff output).
**Fix:** `git cat-file -e HEAD:NOTES.md 2>/dev/null` — only exits 0 if the blob exists at that ref.

Applies to any branch/ref, not just HEAD:
- `git cat-file -e feature:feature.txt`
- `git cat-file -e main:feature.txt`

## Rule 2 — Never use `git branch --list NAME | grep -q NAME` for exact branch match

**Bad:** `git branch --list feature | grep -q feature` — matches "feature-dev", "my-feature", etc.
**Fix:** `git show-ref --verify --quiet refs/heads/feature`

## Rule 3 — Clean up side-effect files in verify scripts

If a verify script creates test files (e.g. `touch app.log; mkdir build`), they persist across runs.
**Fix:** Remove them at the START of the check (idempotent reset) and again at the END.

```sh
rm -f app.log build/output.bin 2>/dev/null
rmdir build 2>/dev/null
touch app.log
mkdir -p build
touch build/output.bin
# ... check ...
rm -f app.log build/output.bin 2>/dev/null
rmdir build 2>/dev/null
```

## Rule 4 — Use exact URL match for git remote checks

**Bad:** `git remote -v | grep -q "origin.*remote.git"` — matches partial remote names.
**Fix:** `git remote get-url origin 2>/dev/null | grep -qF "/root/remote.git"`

## Rule 5 — Bypass-able checks must verify the OPERATION happened, not just the end state

**Stash:** `git reflog show stash | grep -q .` proves stash was used.
**Reset:** `git reflog | grep -q "reset: moving to HEAD"` proves reset ran.
**Why:** End-state checks (commit count, file content) can be reached without doing the actual operation.

## Rule 6 — Seed required state in setupScript for "delete" tasks

If a check is `lightweight_tag_deleted`, the setup must create it first (`git tag v0.1`).
Without seeding, the check passes vacuously on a fresh container.

## DB patch workflow

After fixing a YAML, patch the DB immediately (sync pulls from GitHub, not local files):
```bash
# 1. Edit the YAML
# 2. Commit
# 3. Get current GitHub SHA (to freeze sync):
curl -s "https://api.github.com/repos/Shivam-yd/Linux-Lab-Master/contents/<path>" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.sha)})"
# 4. Build SQL and run via psql:
psql "$DATABASE_URL" -c "UPDATE remote_labs SET definition = jsonb_set(definition, '{verifyScript}', to_jsonb('<escaped>'::text)), sha = '<github_sha>' WHERE id = '<lab_id>' RETURNING id;"
```
