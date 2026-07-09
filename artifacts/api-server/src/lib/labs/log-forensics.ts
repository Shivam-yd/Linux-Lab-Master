import type { LabDefinition } from "./types";

export const logForensics: LabDefinition = {
  id: "log-forensics",
  title: "Log Forensics: Finding the Root Cause",
  category: "Troubleshooting",
  difficulty: "intermediate",
  summary:
    "Dig through a noisy application log with grep, awk, and sed to find which IP address is hammering the login endpoint and how many times.",
  estimatedMinutes: 20,
  order: 5,
  image: "ubuntu:24.04",
  shell: "bash",
  terminals: [{ name: "main", user: "root", cwd: "/var/log/app" }],
  objectives: [
    "Find every ERROR line in /var/log/app/access.log",
    "Identify the single IP address responsible for the most failed login attempts",
    "Write that IP address to /root/answer.txt",
  ],
  instructions: `## Scenario

\`/var/log/app/access.log\` contains a mix of normal traffic and a brute-force login attack. Someone is repeatedly hitting \`/login\` and getting \`ERROR 401\` responses.

## Steps

1. Use \`grep\` to isolate the \`ERROR 401\` lines for the \`/login\` endpoint.
2. Extract the IP address (first field of each line) from those lines and count occurrences per IP — \`awk\`, \`sort\`, and \`uniq -c\` are your friends here.
3. Determine which single IP has the most failed \`/login\` attempts.
4. Write just that IP address (nothing else) to \`/root/answer.txt\`.

A one-liner like this general shape will get you there:
\`grep '/login' access.log | grep 'ERROR 401' | awk '{print $1}' | sort | uniq -c | sort -rn | head -1\``,
  tasks: [
    { id: "answer_file", description: "/root/answer.txt exists" },
    { id: "correct_ip", description: "/root/answer.txt contains the correct attacking IP address" },
  ],
  setupScript: `
mkdir -p /var/log/app
python3 - <<'PYEOF' 2>/dev/null || true
PYEOF
cat > /var/log/app/access.log <<'EOF'
10.0.0.5 - - "GET /home" OK 200
10.0.0.7 - - "GET /login" OK 200
203.0.113.9 - - "POST /login" ERROR 401
10.0.0.5 - - "GET /dashboard" OK 200
203.0.113.9 - - "POST /login" ERROR 401
10.0.0.9 - - "GET /home" OK 200
203.0.113.9 - - "POST /login" ERROR 401
10.0.0.5 - - "POST /login" OK 200
203.0.113.9 - - "POST /login" ERROR 401
198.51.100.4 - - "POST /login" ERROR 401
203.0.113.9 - - "POST /login" ERROR 401
10.0.0.7 - - "GET /home" OK 200
198.51.100.4 - - "POST /login" ERROR 401
203.0.113.9 - - "POST /login" ERROR 401
10.0.0.9 - - "GET /dashboard" OK 200
203.0.113.9 - - "POST /login" ERROR 401
EOF
`,
  verifyScript: `
if [ -f /root/answer.txt ]; then
  echo "CHECK:answer_file:PASS:/root/answer.txt exists."
else
  echo "CHECK:answer_file:FAIL:/root/answer.txt does not exist yet."
fi

EXPECTED="203.0.113.9"
ACTUAL=$(tr -d '[:space:]' < /root/answer.txt 2>/dev/null)
if [ "$ACTUAL" = "$EXPECTED" ]; then
  echo "CHECK:correct_ip:PASS:answer.txt correctly identifies $EXPECTED as the attacking IP."
else
  echo "CHECK:correct_ip:FAIL:answer.txt contains '$ACTUAL', expected the IP with the most ERROR 401 /login attempts ($EXPECTED)."
fi
`,
};
