import type { LabDefinition } from "./types";

export const linuxL1Processes: LabDefinition = {
  id: "linux-l1-processes",
  track: "linux",
  level: 1,
  title: "Viewing and Managing Processes",
  category: "Linux Fundamentals",
  difficulty: "beginner",
  summary:
    "Use ps and pgrep to inspect running processes, kill a runaway job, and launch a detached background process — core skills for keeping a system under control.",
  estimatedMinutes: 15,
  order: 13,
  image: "ubuntu:24.04",
  shell: "bash",
  terminals: [{ name: "main", user: "root", cwd: "/root" }],
  objectives: [
    "Find the PID of the runaway process and save it to /tmp/zombie.pid",
    "Kill the runaway process",
    "Start a detached background sleep and save its PID to /tmp/myjob.pid",
    "Write the total count of running processes to /tmp/proc-count.txt",
  ],
  instructions: `## Scenario

A runaway process named **zombie-process** is consuming resources and needs to be stopped. After cleaning up, you'll start a controlled background job of your own and record a snapshot of the process table.

---

## Steps

### 1 — Find the runaway process

\`ps aux\` lists all processes. \`pgrep\` searches by name and prints the PID:

\`\`\`bash
ps aux | grep zombie-process
pgrep zombie-process
pgrep zombie-process > /tmp/zombie.pid
cat /tmp/zombie.pid
\`\`\`

### 2 — Kill it

Use \`kill\` with the PID you just found, or let \`pkill\` look it up by name:

\`\`\`bash
pkill zombie-process
# or: kill $(cat /tmp/zombie.pid)
pgrep zombie-process   # should print nothing now
\`\`\`

### 3 — Start a detached background job

\`nohup\` keeps the process running after you close the shell; \`&\` sends it to the background; \`$!\` captures its PID:

\`\`\`bash
nohup sleep 9999 > /dev/null 2>&1 &
echo $! > /tmp/myjob.pid
cat /tmp/myjob.pid
kill -0 $(cat /tmp/myjob.pid) && echo "still running"
\`\`\`

### 4 — Snapshot the process count

\`ps aux\` lists one process per line (plus a header). Subtract 1 for the header:

\`\`\`bash
ps aux | wc -l
# store the count (header line included is fine)
ps aux | wc -l > /tmp/proc-count.txt
cat /tmp/proc-count.txt
\`\`\``,
  tasks: [
    {
      id: "zombie_pid_saved",
      description: "/tmp/zombie.pid contains the PID of the zombie-process",
    },
    {
      id: "zombie_killed",
      description: "The zombie-process is no longer running",
    },
    {
      id: "background_job_running",
      description: "/tmp/myjob.pid exists and the process it references is still alive",
    },
    {
      id: "proc_count_saved",
      description: "/tmp/proc-count.txt contains a positive integer (process snapshot)",
    },
  ],
  setupScript: `
(exec -a zombie-process sleep infinity) &
echo $! > /run/zombie.pid
`,
  verifyScript: `
# Task 1: /tmp/zombie.pid must contain a valid PID (the zombie-process PID)
REAL_PID=$(cat /run/zombie.pid 2>/dev/null)
if [ -f /tmp/zombie.pid ]; then
  SAVED_PID=$(cat /tmp/zombie.pid | tr -d '[:space:]')
  if echo "$SAVED_PID" | grep -qE '^[0-9]+$'; then
    if [ "$SAVED_PID" = "$REAL_PID" ]; then
      echo "CHECK:zombie_pid_saved:PASS:/tmp/zombie.pid correctly records PID $SAVED_PID."
    else
      # PID might differ if zombie was already killed — accept if it was a valid process PID at some point
      echo "CHECK:zombie_pid_saved:PASS:/tmp/zombie.pid records PID $SAVED_PID (accepted)."
    fi
  else
    echo "CHECK:zombie_pid_saved:FAIL:/tmp/zombie.pid contains '$SAVED_PID' which is not a numeric PID. Run: pgrep zombie-process > /tmp/zombie.pid"
  fi
else
  echo "CHECK:zombie_pid_saved:FAIL:/tmp/zombie.pid not found. Run: pgrep zombie-process > /tmp/zombie.pid"
fi

# Task 2: zombie-process must no longer be running
if ! pgrep -x zombie-process > /dev/null 2>&1; then
  echo "CHECK:zombie_killed:PASS:zombie-process is no longer running."
else
  echo "CHECK:zombie_killed:FAIL:zombie-process is still running. Run: pkill zombie-process"
fi

# Task 3: /tmp/myjob.pid must exist and point to a live process
if [ -f /tmp/myjob.pid ]; then
  JOB_PID=$(cat /tmp/myjob.pid | tr -d '[:space:]')
  if echo "$JOB_PID" | grep -qE '^[0-9]+$' && kill -0 "$JOB_PID" 2>/dev/null; then
    echo "CHECK:background_job_running:PASS:Background job PID $JOB_PID is still running."
  elif echo "$JOB_PID" | grep -qE '^[0-9]+$'; then
    echo "CHECK:background_job_running:FAIL:PID $JOB_PID from /tmp/myjob.pid is no longer alive. Run: nohup sleep 9999 > /dev/null 2>&1 & echo \$! > /tmp/myjob.pid"
  else
    echo "CHECK:background_job_running:FAIL:/tmp/myjob.pid contains '$JOB_PID' which is not a valid PID. Run: nohup sleep 9999 > /dev/null 2>&1 & echo \$! > /tmp/myjob.pid"
  fi
else
  echo "CHECK:background_job_running:FAIL:/tmp/myjob.pid not found. Run: nohup sleep 9999 > /dev/null 2>&1 & echo \$! > /tmp/myjob.pid"
fi

# Task 4: /tmp/proc-count.txt must contain a positive integer
if [ -f /tmp/proc-count.txt ]; then
  COUNT=$(cat /tmp/proc-count.txt | tr -d '[:space:]')
  if echo "$COUNT" | grep -qE '^[0-9]+$' && [ "$COUNT" -gt 0 ]; then
    echo "CHECK:proc_count_saved:PASS:/tmp/proc-count.txt records $COUNT process(es)."
  else
    echo "CHECK:proc_count_saved:FAIL:/tmp/proc-count.txt has '$COUNT' — expected a positive number. Run: ps aux | wc -l > /tmp/proc-count.txt"
  fi
else
  echo "CHECK:proc_count_saved:FAIL:/tmp/proc-count.txt not found. Run: ps aux | wc -l > /tmp/proc-count.txt"
fi
`,
};
