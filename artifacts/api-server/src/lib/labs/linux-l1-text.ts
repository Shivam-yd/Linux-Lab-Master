import type { LabDefinition } from "./types";

export const linuxL1Text: LabDefinition = {
  id: "linux-l1-text",
  track: "linux",
  level: 1,
  title: "Reading and Searching Files",
  category: "Linux Fundamentals",
  difficulty: "beginner",
  summary:
    "Use cat, head, tail, grep, and wc to inspect and search log files — essential skills for diagnosing problems on a live system.",
  estimatedMinutes: 15,
  order: 12,
  image: "ubuntu:24.04",
  shell: "bash",
  terminals: [{ name: "main", user: "root", cwd: "/root" }],
  objectives: [
    "Extract all ERROR lines from the log into /tmp/errors.txt",
    "Save the total line count of the log to /tmp/linecount.txt",
    "Save the first 5 lines of the log to /tmp/head.txt",
    "Count WARN occurrences and save the number to /tmp/warn-count.txt",
  ],
  instructions: `## Scenario

A service has been logging to \`/var/log/app.log\`. Your job is to triage the log: pull out all error lines, check how big it's grown, grab a quick preview from the top, and count warnings.

---

## Steps

### 1 — Extract ERROR lines

\`grep\` filters lines that match a pattern:

\`\`\`bash
grep "ERROR" /var/log/app.log
grep "ERROR" /var/log/app.log > /tmp/errors.txt
wc -l /tmp/errors.txt    # how many errors?
\`\`\`

### 2 — Count all lines in the log

\`wc -l\` counts newlines in a file:

\`\`\`bash
wc -l /var/log/app.log
wc -l < /var/log/app.log > /tmp/linecount.txt
cat /tmp/linecount.txt
\`\`\`

### 3 — Preview the top of the log

\`head\` shows the first N lines (default 10, \`-n 5\` for five):

\`\`\`bash
head -n 5 /var/log/app.log
head -n 5 /var/log/app.log > /tmp/head.txt
\`\`\`

### 4 — Count WARN occurrences

Use \`grep -c\` to count matching lines, or pipe into \`wc -l\`:

\`\`\`bash
grep -c "WARN" /var/log/app.log
grep -c "WARN" /var/log/app.log > /tmp/warn-count.txt
cat /tmp/warn-count.txt
\`\`\``,
  tasks: [
    {
      id: "errors_extracted",
      description: "/tmp/errors.txt contains only lines with ERROR from the log",
    },
    {
      id: "linecount_saved",
      description: "/tmp/linecount.txt contains the correct total line count",
    },
    {
      id: "head_saved",
      description: "/tmp/head.txt contains exactly the first 5 lines of the log",
    },
    {
      id: "warn_count_saved",
      description: "/tmp/warn-count.txt contains the correct count of WARN lines",
    },
  ],
  setupScript: `
mkdir -p /var/log
cat > /var/log/app.log <<'EOF'
2024-01-15 08:00:01 INFO  Server starting on port 8080
2024-01-15 08:00:02 INFO  Database connection established
2024-01-15 08:00:05 INFO  Cache warmed up (1240 entries)
2024-01-15 08:01:10 WARN  High memory usage detected: 82%
2024-01-15 08:01:45 INFO  Request processed: GET /api/users (120ms)
2024-01-15 08:02:03 ERROR Disk I/O timeout on /dev/sdb after 30s
2024-01-15 08:02:15 INFO  Retry attempt 1 for disk operation
2024-01-15 08:02:30 ERROR Disk I/O timeout on /dev/sdb after 30s
2024-01-15 08:03:01 WARN  Retry limit approaching (2/3)
2024-01-15 08:03:15 ERROR Disk operation failed permanently — data loss possible
2024-01-15 08:03:16 INFO  Failover to secondary disk initiated
2024-01-15 08:03:45 WARN  Secondary disk at 91% capacity
2024-01-15 08:04:00 INFO  Failover complete
2024-01-15 08:05:12 INFO  Health check: OK
2024-01-15 08:06:00 WARN  Response time degraded: avg 890ms (threshold 500ms)
2024-01-15 08:07:30 INFO  Scheduled maintenance window starting
2024-01-15 08:10:00 INFO  Maintenance complete — all services healthy
EOF
`,
  verifyScript: `
LOG=/var/log/app.log

# Task 1: /tmp/errors.txt must match grep "ERROR" output
if [ -f /tmp/errors.txt ]; then
  EXPECTED=$(grep "ERROR" "$LOG" 2>/dev/null)
  ACTUAL=$(cat /tmp/errors.txt)
  if [ "$EXPECTED" = "$ACTUAL" ]; then
    echo "CHECK:errors_extracted:PASS:/tmp/errors.txt contains all $(echo "$EXPECTED" | wc -l) ERROR line(s)."
  else
    echo "CHECK:errors_extracted:FAIL:/tmp/errors.txt doesn't match the ERROR lines in the log. Run: grep \"ERROR\" /var/log/app.log > /tmp/errors.txt"
  fi
else
  echo "CHECK:errors_extracted:FAIL:/tmp/errors.txt not found. Run: grep \"ERROR\" /var/log/app.log > /tmp/errors.txt"
fi

# Task 2: /tmp/linecount.txt must contain the correct line count
EXPECTED_COUNT=$(wc -l < "$LOG" 2>/dev/null | tr -d '[:space:]')
if [ -f /tmp/linecount.txt ]; then
  ACTUAL_COUNT=$(cat /tmp/linecount.txt | tr -d '[:space:]')
  if [ "$ACTUAL_COUNT" = "$EXPECTED_COUNT" ]; then
    echo "CHECK:linecount_saved:PASS:/tmp/linecount.txt correctly shows $EXPECTED_COUNT lines."
  else
    echo "CHECK:linecount_saved:FAIL:/tmp/linecount.txt has '$ACTUAL_COUNT' but expected '$EXPECTED_COUNT'. Run: wc -l < /var/log/app.log > /tmp/linecount.txt"
  fi
else
  echo "CHECK:linecount_saved:FAIL:/tmp/linecount.txt not found. Run: wc -l < /var/log/app.log > /tmp/linecount.txt"
fi

# Task 3: /tmp/head.txt must match the first 5 lines exactly
EXPECTED_HEAD=$(head -n 5 "$LOG" 2>/dev/null)
if [ -f /tmp/head.txt ]; then
  ACTUAL_HEAD=$(cat /tmp/head.txt)
  if [ "$EXPECTED_HEAD" = "$ACTUAL_HEAD" ]; then
    echo "CHECK:head_saved:PASS:/tmp/head.txt contains the correct first 5 lines."
  else
    ACTUAL_LINES=$(wc -l < /tmp/head.txt | tr -d '[:space:]')
    echo "CHECK:head_saved:FAIL:/tmp/head.txt has $ACTUAL_LINES line(s) but doesn't match the first 5 lines. Run: head -n 5 /var/log/app.log > /tmp/head.txt"
  fi
else
  echo "CHECK:head_saved:FAIL:/tmp/head.txt not found. Run: head -n 5 /var/log/app.log > /tmp/head.txt"
fi

# Task 4: /tmp/warn-count.txt must contain the correct WARN count
EXPECTED_WARN=$(grep -c "WARN" "$LOG" 2>/dev/null | tr -d '[:space:]')
if [ -f /tmp/warn-count.txt ]; then
  ACTUAL_WARN=$(cat /tmp/warn-count.txt | tr -d '[:space:]')
  if [ "$ACTUAL_WARN" = "$EXPECTED_WARN" ]; then
    echo "CHECK:warn_count_saved:PASS:/tmp/warn-count.txt correctly shows $EXPECTED_WARN WARN line(s)."
  else
    echo "CHECK:warn_count_saved:FAIL:/tmp/warn-count.txt has '$ACTUAL_WARN' but expected '$EXPECTED_WARN'. Run: grep -c \"WARN\" /var/log/app.log > /tmp/warn-count.txt"
  fi
else
  echo "CHECK:warn_count_saved:FAIL:/tmp/warn-count.txt not found. Run: grep -c \"WARN\" /var/log/app.log > /tmp/warn-count.txt"
fi
`,
};
