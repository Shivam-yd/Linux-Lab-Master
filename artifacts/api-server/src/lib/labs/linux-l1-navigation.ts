import type { LabDefinition } from "./types";

export const linuxL1Navigation: LabDefinition = {
  id: "linux-l1-navigation",
  track: "linux",
  level: 1,
  title: "Navigating the Filesystem",
  category: "Linux Fundamentals",
  difficulty: "beginner",
  summary:
    "Get comfortable with the Linux directory tree — explore paths, locate files, and use pwd, ls, cd, and find to map out an unfamiliar system.",
  estimatedMinutes: 15,
  order: 10,
  image: "ubuntu:24.04",
  shell: "bash",
  terminals: [{ name: "main", user: "root", cwd: "/root" }],
  objectives: [
    "Record your working path inside /challenge/mission using pwd",
    "List all contents of /challenge including hidden files",
    "Locate and copy the hidden .flag file to /tmp/",
    "Count all .conf files under /challenge using find",
  ],
  instructions: `## Scenario

You've just SSH'd into an unfamiliar server. Before you can do any real work you need to orient yourself — find out where important files live, spot hidden files, and be able to locate configs buried in subdirectories.

Working directory: anywhere you like.

---

## Steps

### 1 — Record your current path inside /challenge/mission

\`\`\`bash
cd /challenge/mission
pwd > /tmp/location.txt
cat /tmp/location.txt     # should print /challenge/mission
\`\`\`

### 2 — List all contents of /challenge (including hidden files)

The \`-a\` flag shows hidden files (names starting with \`.\`). Save the listing so you have a record:

\`\`\`bash
ls -la /challenge > /tmp/listing.txt
cat /tmp/listing.txt
\`\`\`

### 3 — Find and copy the hidden flag file

You'll notice a hidden file in the output above. Copy it to /tmp/:

\`\`\`bash
cp /challenge/.flag /tmp/flag
cat /tmp/flag
\`\`\`

### 4 — Count .conf files anywhere under /challenge

\`find\` recurses through all subdirectories. The \`-name\` flag filters by filename pattern:

\`\`\`bash
find /challenge -name "*.conf" | wc -l
find /challenge -name "*.conf" | wc -l > /tmp/conf-count.txt
cat /tmp/conf-count.txt
\`\`\``,
  tasks: [
    {
      id: "location_saved",
      description: "/tmp/location.txt contains the path /challenge/mission",
    },
    {
      id: "listing_saved",
      description: "/tmp/listing.txt exists and contains the ls -la output for /challenge",
    },
    {
      id: "hidden_found",
      description: "/tmp/flag exists and matches the content of /challenge/.flag",
    },
    {
      id: "conf_count_saved",
      description: "/tmp/conf-count.txt contains the correct count of .conf files under /challenge",
    },
  ],
  setupScript: `
mkdir -p /challenge/mission /challenge/config/db /challenge/logs
echo "MISSION_CONTROL" > /challenge/mission/briefing.txt
echo "server: localhost" > /challenge/config/app.conf
echo "server: db01"     > /challenge/config/db.conf
echo "backup: /tmp"     > /challenge/config/backup.conf
echo "db_host: 127.0.0.1" > /challenge/config/db/database.conf
echo "secret_token=challenge_flag_001" > /challenge/.flag
echo "app started at boot" > /challenge/logs/app.log
`,
  verifyScript: `
# Task 1: /tmp/location.txt must contain /challenge/mission
if [ -f /tmp/location.txt ] && grep -qF "/challenge/mission" /tmp/location.txt; then
  echo "CHECK:location_saved:PASS:/tmp/location.txt correctly records /challenge/mission."
elif [ -f /tmp/location.txt ]; then
  CONTENT=$(cat /tmp/location.txt | tr -d '[:space:]')
  echo "CHECK:location_saved:FAIL:/tmp/location.txt exists but contains '$CONTENT' — run: cd /challenge/mission && pwd > /tmp/location.txt"
else
  echo "CHECK:location_saved:FAIL:/tmp/location.txt not found. Run: cd /challenge/mission && pwd > /tmp/location.txt"
fi

# Task 2: /tmp/listing.txt must exist and be non-empty
if [ -f /tmp/listing.txt ] && [ -s /tmp/listing.txt ]; then
  echo "CHECK:listing_saved:PASS:/tmp/listing.txt exists with content."
elif [ -f /tmp/listing.txt ]; then
  echo "CHECK:listing_saved:FAIL:/tmp/listing.txt is empty. Run: ls -la /challenge > /tmp/listing.txt"
else
  echo "CHECK:listing_saved:FAIL:/tmp/listing.txt not found. Run: ls -la /challenge > /tmp/listing.txt"
fi

# Task 3: /tmp/flag must match /challenge/.flag
if [ -f /tmp/flag ]; then
  EXPECTED=$(cat /challenge/.flag 2>/dev/null)
  ACTUAL=$(cat /tmp/flag 2>/dev/null)
  if [ "$EXPECTED" = "$ACTUAL" ]; then
    echo "CHECK:hidden_found:PASS:/tmp/flag matches the hidden .flag file."
  else
    echo "CHECK:hidden_found:FAIL:/tmp/flag content doesn't match /challenge/.flag. Run: cp /challenge/.flag /tmp/flag"
  fi
else
  echo "CHECK:hidden_found:FAIL:/tmp/flag not found. Run: cp /challenge/.flag /tmp/flag"
fi

# Task 4: /tmp/conf-count.txt must contain the correct count (4)
EXPECTED_COUNT=$(find /challenge -name "*.conf" 2>/dev/null | wc -l | tr -d '[:space:]')
if [ -f /tmp/conf-count.txt ]; then
  ACTUAL_COUNT=$(cat /tmp/conf-count.txt | tr -d '[:space:]')
  if [ "$ACTUAL_COUNT" = "$EXPECTED_COUNT" ]; then
    echo "CHECK:conf_count_saved:PASS:/tmp/conf-count.txt correctly shows $EXPECTED_COUNT .conf files."
  else
    echo "CHECK:conf_count_saved:FAIL:/tmp/conf-count.txt has '$ACTUAL_COUNT' but expected '$EXPECTED_COUNT'. Run: find /challenge -name \"*.conf\" | wc -l > /tmp/conf-count.txt"
  fi
else
  echo "CHECK:conf_count_saved:FAIL:/tmp/conf-count.txt not found. Run: find /challenge -name \"*.conf\" | wc -l > /tmp/conf-count.txt"
fi
`,
};
