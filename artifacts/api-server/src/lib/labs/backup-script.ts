import type { LabDefinition } from "./types";

export const backupScript: LabDefinition = {
  id: "backup-script",
  track: "linux",
  level: 3,
  title: "Shell Scripting: Automated Backup Script",
  category: "Automation",
  difficulty: "advanced",
  summary:
    "Write a bash script that backs up a directory into a timestamped, compressed archive and keeps only the 3 most recent backups.",
  estimatedMinutes: 25,
  order: 6,
  image: "ubuntu:24.04",
  shell: "bash",
  terminals: [{ name: "main", user: "root", cwd: "/root" }],
  objectives: [
    "Write an executable /usr/local/bin/backup.sh",
    "Running it produces a timestamped .tar.gz of /data/important in /backups",
    "Running it repeatedly keeps at most 3 archives, deleting the oldest",
  ],
  instructions: `## Scenario

\`/data/important\` holds files that must be backed up regularly. You need a reusable backup script, not a one-off command.

## Steps

1. Write \`/usr/local/bin/backup.sh\` (and make it executable) that:
   - Creates \`/backups\` if it doesn't exist.
   - Produces a compressed archive of \`/data/important\` named with a timestamp, e.g. \`/backups/important-YYYYmmdd-HHMMSS.tar.gz\` (use \`date +%Y%m%d-%H%M%S\` and \`tar czf\`).
2. **Retention**: after creating a new archive, the script should ensure only the 3 most recent \`.tar.gz\` files remain in \`/backups\` — delete the oldest ones beyond that. (\`ls -t\`, \`tail -n +4\`, and \`rm\` combine nicely for this.)
3. Test it: run \`backup.sh\` five or more times (a fast loop like \`for i in 1 2 3 4 5; do backup.sh; sleep 1; done\` works, since the timestamp needs to change between runs) and confirm \`/backups\` never holds more than 3 archives.

**No text editor is installed** (no vi, vim, or nano) — write the script with a heredoc instead:

\`\`\`
cat > /usr/local/bin/backup.sh <<'EOF'
#!/bin/bash
...
EOF
chmod +x /usr/local/bin/backup.sh
\`\`\``,
  tasks: [
    { id: "script_executable", description: "backup.sh exists and is executable" },
    { id: "archive_created", description: "Running backup.sh produces a valid timestamped tar.gz of /data/important" },
    { id: "retention_enforced", description: "After several runs, /backups holds at most 3 archives" },
  ],
  setupScript: `
mkdir -p /data/important
echo "quarterly-report.txt" > /data/important/quarterly-report.txt
echo "customer-list.csv" > /data/important/customer-list.csv
mkdir -p /backups
`,
  verifyScript: `
if [ -x /usr/local/bin/backup.sh ]; then
  echo "CHECK:script_executable:PASS:backup.sh exists and is executable."
else
  echo "CHECK:script_executable:FAIL:/usr/local/bin/backup.sh is missing or not executable."
fi

BEFORE=$(ls /backups/*.tar.gz 2>/dev/null | wc -l)
/usr/local/bin/backup.sh >/dev/null 2>&1
sleep 1
AFTER=$(ls /backups/*.tar.gz 2>/dev/null | wc -l)
LATEST=$(ls -t /backups/*.tar.gz 2>/dev/null | head -1)
if [ -n "$LATEST" ] && [ "$AFTER" -gt "$BEFORE" ] && tar tzf "$LATEST" 2>/dev/null | grep -q "important/"; then
  echo "CHECK:archive_created:PASS:Running backup.sh produced a new valid archive of /data/important."
else
  echo "CHECK:archive_created:FAIL:backup.sh did not produce a new, valid tar.gz containing /data/important."
fi

for i in 1 2 3 4 5; do /usr/local/bin/backup.sh >/dev/null 2>&1; sleep 1.1; done
COUNT=$(ls /backups/*.tar.gz 2>/dev/null | wc -l)
if [ "$COUNT" -le 3 ] && [ "$COUNT" -ge 1 ]; then
  echo "CHECK:retention_enforced:PASS:/backups holds $COUNT archive(s), retention is enforced."
else
  echo "CHECK:retention_enforced:FAIL:/backups holds $COUNT archives after repeated runs -- expected at most 3."
fi
`,
};
