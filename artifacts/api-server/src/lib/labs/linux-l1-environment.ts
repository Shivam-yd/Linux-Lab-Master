import type { LabDefinition } from "./types";

export const linuxL1Environment: LabDefinition = {
  id: "linux-l1-environment",
  track: "linux",
  level: 1,
  title: "Shell Environment Variables",
  category: "Linux Fundamentals",
  difficulty: "beginner",
  summary:
    "Configure a deployment environment by setting and exporting shell variables, creating a profile script that persists across sessions, and extending PATH.",
  estimatedMinutes: 15,
  order: 14,
  image: "ubuntu:24.04",
  shell: "bash",
  terminals: [{ name: "main", user: "root", cwd: "/root" }],
  objectives: [
    "Create /etc/profile.d/myapp.sh that exports APP_ENV=production",
    "Add APP_PORT=8080 to the same profile script",
    "Create an executable script at /opt/tools/hello.sh",
    "Add /opt/tools to PATH inside /etc/profile.d/myapp.sh",
  ],
  instructions: `## Scenario

The deployment team needs the server's shell environment pre-configured so that every new login session automatically has the right variables and can run tools from \`/opt/tools\`. You'll write a profile drop-in to set this up persistently.

---

## Steps

### 1 & 2 — Create the profile script

Files in \`/etc/profile.d/\` are sourced by every new Bash login shell. Create one for the app:

\`\`\`bash
cat > /etc/profile.d/myapp.sh <<'EOF'
export APP_ENV=production
export APP_PORT=8080
EOF
\`\`\`

Test it immediately by sourcing it in your current shell:

\`\`\`bash
source /etc/profile.d/myapp.sh
echo "APP_ENV=$APP_ENV  APP_PORT=$APP_PORT"
\`\`\`

### 3 — Create a tool script

\`\`\`bash
mkdir -p /opt/tools
cat > /opt/tools/hello.sh <<'EOF'
#!/bin/bash
echo "Hello from /opt/tools!"
EOF
chmod +x /opt/tools/hello.sh
\`\`\`

### 4 — Add /opt/tools to PATH

Edit the profile script to extend PATH:

\`\`\`bash
echo 'export PATH="$PATH:/opt/tools"' >> /etc/profile.d/myapp.sh
cat /etc/profile.d/myapp.sh     # review the final file

# Re-source to apply in this session
source /etc/profile.d/myapp.sh
echo $PATH | grep /opt/tools     # should print the PATH
hello.sh                          # runs without specifying the full path
\`\`\``,
  tasks: [
    {
      id: "app_env_set",
      description: "/etc/profile.d/myapp.sh exports APP_ENV=production",
    },
    {
      id: "app_port_set",
      description: "/etc/profile.d/myapp.sh exports APP_PORT=8080",
    },
    {
      id: "hello_script",
      description: "/opt/tools/hello.sh exists and is executable",
    },
    {
      id: "path_extended",
      description: "/etc/profile.d/myapp.sh adds /opt/tools to PATH",
    },
  ],
  setupScript: `
mkdir -p /opt/tools /etc/profile.d
`,
  verifyScript: `
PROFILE=/etc/profile.d/myapp.sh

# Task 1: profile script exports APP_ENV=production
if [ -f "$PROFILE" ]; then
  if grep -v '^[[:space:]]*#' "$PROFILE" | grep -qE 'export[[:space:]]+APP_ENV=production|APP_ENV=production.*export'; then
    echo "CHECK:app_env_set:PASS:APP_ENV=production is exported in $PROFILE."
  elif grep -qE 'APP_ENV' "$PROFILE"; then
    VAL=$(grep -v '^[[:space:]]*#' "$PROFILE" | grep 'APP_ENV' | head -1)
    echo "CHECK:app_env_set:FAIL:APP_ENV is set but not as 'production': $VAL — use: export APP_ENV=production"
  else
    echo "CHECK:app_env_set:FAIL:APP_ENV not found in $PROFILE. Add: export APP_ENV=production"
  fi
else
  echo "CHECK:app_env_set:FAIL:$PROFILE does not exist. Create it with: cat > /etc/profile.d/myapp.sh and add export APP_ENV=production"
fi

# Task 2: profile script exports APP_PORT=8080
if [ -f "$PROFILE" ]; then
  if grep -v '^[[:space:]]*#' "$PROFILE" | grep -qE 'export[[:space:]]+APP_PORT=8080|APP_PORT=8080.*export'; then
    echo "CHECK:app_port_set:PASS:APP_PORT=8080 is exported in $PROFILE."
  elif grep -qE 'APP_PORT' "$PROFILE"; then
    VAL=$(grep -v '^[[:space:]]*#' "$PROFILE" | grep 'APP_PORT' | head -1)
    echo "CHECK:app_port_set:FAIL:APP_PORT is set but not to 8080: $VAL — use: export APP_PORT=8080"
  else
    echo "CHECK:app_port_set:FAIL:APP_PORT not found in $PROFILE. Add: export APP_PORT=8080"
  fi
else
  echo "CHECK:app_port_set:FAIL:$PROFILE does not exist. Create it first."
fi

# Task 3: /opt/tools/hello.sh exists and is executable
if [ -f /opt/tools/hello.sh ] && [ -x /opt/tools/hello.sh ]; then
  echo "CHECK:hello_script:PASS:/opt/tools/hello.sh exists and is executable."
elif [ -f /opt/tools/hello.sh ]; then
  echo "CHECK:hello_script:FAIL:/opt/tools/hello.sh exists but is not executable. Run: chmod +x /opt/tools/hello.sh"
else
  echo "CHECK:hello_script:FAIL:/opt/tools/hello.sh not found. Create it and run: chmod +x /opt/tools/hello.sh"
fi

# Task 4: profile script adds /opt/tools to PATH
if [ -f "$PROFILE" ]; then
  if grep -v '^[[:space:]]*#' "$PROFILE" | grep -qE 'PATH.*(/opt/tools)|(/opt/tools).*PATH'; then
    echo "CHECK:path_extended:PASS:/opt/tools is added to PATH in $PROFILE."
  else
    echo "CHECK:path_extended:FAIL:/opt/tools not found in PATH assignment in $PROFILE. Add: export PATH=\"\$PATH:/opt/tools\""
  fi
else
  echo "CHECK:path_extended:FAIL:$PROFILE does not exist. Create it first."
fi
`,
};
