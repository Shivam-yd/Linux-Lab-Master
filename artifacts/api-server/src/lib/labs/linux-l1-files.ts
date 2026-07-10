import type { LabDefinition } from "./types";

export const linuxL1Files: LabDefinition = {
  id: "linux-l1-files",
  track: "linux",
  level: 1,
  title: "File and Directory Operations",
  category: "Linux Fundamentals",
  difficulty: "beginner",
  summary:
    "Create, copy, move, and delete files and directories — the everyday operations every Linux user needs to know.",
  estimatedMinutes: 15,
  order: 11,
  image: "ubuntu:24.04",
  shell: "bash",
  terminals: [{ name: "main", user: "root", cwd: "/workspace" }],
  objectives: [
    "Create a reports/ directory inside /workspace",
    "Create a file /workspace/reports/summary.txt with any content",
    "Copy summary.txt to /workspace/archive/ as summary.bak",
    "Remove the /workspace/old-data/ directory entirely",
  ],
  instructions: `## Scenario

You're organising files on a server after a messy handover. You need to create the right directory structure, save a summary note, archive a copy, and clean up outdated data.

Working directory: \`/workspace\`

---

## Steps

### 1 — Create the reports directory

\`\`\`bash
mkdir /workspace/reports
ls /workspace      # should show reports/
\`\`\`

### 2 — Create a summary file

Use a heredoc or echo to write any content into the file:

\`\`\`bash
echo "Handover complete — system looks healthy." > /workspace/reports/summary.txt
cat /workspace/reports/summary.txt
\`\`\`

### 3 — Archive a copy

Create the archive directory and copy the file with a new name:

\`\`\`bash
mkdir -p /workspace/archive
cp /workspace/reports/summary.txt /workspace/archive/summary.bak
ls /workspace/archive
\`\`\`

### 4 — Remove old data

The old-data directory is no longer needed. The \`-r\` flag removes directories recursively:

\`\`\`bash
rm -r /workspace/old-data
ls /workspace     # old-data should no longer appear
\`\`\``,
  tasks: [
    {
      id: "reports_dir",
      description: "/workspace/reports/ directory exists",
    },
    {
      id: "summary_file",
      description: "/workspace/reports/summary.txt exists with content",
    },
    {
      id: "archive_copy",
      description: "/workspace/archive/summary.bak exists",
    },
    {
      id: "old_data_removed",
      description: "/workspace/old-data/ has been deleted",
    },
  ],
  setupScript: `
mkdir -p /workspace/old-data
echo "legacy report Q1"  > /workspace/old-data/report-q1.txt
echo "legacy report Q2"  > /workspace/old-data/report-q2.txt
echo "migration notes"   > /workspace/old-data/notes.txt
`,
  verifyScript: `
# Task 1: /workspace/reports/ directory exists
if [ -d /workspace/reports ]; then
  echo "CHECK:reports_dir:PASS:/workspace/reports/ directory exists."
else
  echo "CHECK:reports_dir:FAIL:/workspace/reports/ not found. Run: mkdir /workspace/reports"
fi

# Task 2: /workspace/reports/summary.txt exists and is non-empty
if [ -f /workspace/reports/summary.txt ] && [ -s /workspace/reports/summary.txt ]; then
  echo "CHECK:summary_file:PASS:/workspace/reports/summary.txt exists with content."
elif [ -f /workspace/reports/summary.txt ]; then
  echo "CHECK:summary_file:FAIL:/workspace/reports/summary.txt exists but is empty. Write something into it."
else
  echo "CHECK:summary_file:FAIL:/workspace/reports/summary.txt not found. Run: echo \"notes\" > /workspace/reports/summary.txt"
fi

# Task 3: /workspace/archive/summary.bak exists
if [ -f /workspace/archive/summary.bak ]; then
  echo "CHECK:archive_copy:PASS:/workspace/archive/summary.bak exists."
else
  echo "CHECK:archive_copy:FAIL:/workspace/archive/summary.bak not found. Run: mkdir -p /workspace/archive && cp /workspace/reports/summary.txt /workspace/archive/summary.bak"
fi

# Task 4: /workspace/old-data/ is gone
if [ ! -e /workspace/old-data ]; then
  echo "CHECK:old_data_removed:PASS:/workspace/old-data has been removed."
else
  echo "CHECK:old_data_removed:FAIL:/workspace/old-data still exists. Run: rm -r /workspace/old-data"
fi
`,
};
