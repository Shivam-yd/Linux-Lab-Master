import type { LabDefinition } from "./types";

export const cronAutomation: LabDefinition = {
  id: "cron-automation",
  title: "Cron Job Scheduling & Automation",
  category: "Automation",
  difficulty: "intermediate",
  summary:
    "Write a disk-space-check script and schedule it to run automatically every 5 minutes with cron.",
  estimatedMinutes: 20,
  order: 4,
  image: "alpine:latest",
  shell: "sh",
  terminals: [{ name: "main", user: "root", cwd: "/root" }],
  objectives: [
    "Write an executable script at /usr/local/bin/check-disk.sh that appends a line to /var/log/disk-check.log",
    "Schedule it in root's crontab to run every 5 minutes",
    "Have the crond daemon actually running",
  ],
  instructions: `## Scenario

Ops wants a lightweight heartbeat: every 5 minutes, a script should append a timestamped line to \`/var/log/disk-check.log\` reporting free disk space.

## Steps

1. Write a script at \`/usr/local/bin/check-disk.sh\` that appends a line like \`<timestamp> <df output>\` to \`/var/log/disk-check.log\` each time it runs (e.g. \`echo "$(date): $(df -h /)" >> /var/log/disk-check.log\`). Make it executable. No text editor is installed besides BusyBox's minimal \`vi\`, so it's easiest to write it with a heredoc: \`cat > /usr/local/bin/check-disk.sh <<'EOF' ... EOF\` then \`chmod +x\`.
2. Add a line to root's crontab scheduling that script every 5 minutes: \`*/5 * * * * /usr/local/bin/check-disk.sh\`. Avoid \`crontab -e\` (it drops you into \`vi\`, which is hard to use in a browser terminal) — instead pipe the entry straight in: \`(crontab -l 2>/dev/null; echo '*/5 * * * * /usr/local/bin/check-disk.sh') | crontab -\`. Use \`crontab -l\` to inspect the result.
3. Make sure the cron daemon is actually running (\`crond\` on this system) — a schedule with no daemon running never fires.

This is Alpine Linux, so cron is provided by BusyBox's \`crond\`/\`crontab\`, not the Debian cron package.`,
  tasks: [
    { id: "script_exists", description: "check-disk.sh exists, is executable, and appends to the log" },
    { id: "crontab_entry", description: "root's crontab schedules check-disk.sh every 5 minutes" },
    { id: "crond_running", description: "the crond daemon is running" },
  ],
  setupScript: `
mkdir -p /var/log
touch /var/log/disk-check.log
`,
  verifyScript: `
if [ -x /usr/local/bin/check-disk.sh ] && grep -q "disk-check.log" /usr/local/bin/check-disk.sh; then
  echo "CHECK:script_exists:PASS:check-disk.sh exists, is executable, and references the log file."
else
  echo "CHECK:script_exists:FAIL:/usr/local/bin/check-disk.sh is missing, not executable, or doesn't write to /var/log/disk-check.log."
fi

CRON=$(crontab -l 2>/dev/null)
if echo "$CRON" | grep -Eq '^\\*/5 \\* \\* \\* \\* .*check-disk\\.sh'; then
  echo "CHECK:crontab_entry:PASS:root's crontab runs check-disk.sh every 5 minutes."
else
  echo "CHECK:crontab_entry:FAIL:No crontab line found matching '*/5 * * * * .../check-disk.sh'. Current crontab: $(echo "$CRON" | tr '\\n' ';' | cut -c1-150)"
fi

if pgrep crond >/dev/null 2>&1; then
  echo "CHECK:crond_running:PASS:crond is running."
else
  echo "CHECK:crond_running:FAIL:crond does not appear to be running. Start it with: crond"
fi
`,
};
