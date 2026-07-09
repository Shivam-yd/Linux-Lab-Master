import type { LabDefinition } from "./types";

export const filePermissions: LabDefinition = {
  id: "file-permissions",
  track: "linux",
  level: 2,
  title: "File Permissions & Ownership Troubleshooting",
  category: "System Administration",
  difficulty: "beginner",
  summary:
    "A deploy script is failing because of broken ownership and permissions. Track down and fix every misconfigured file.",
  estimatedMinutes: 15,
  order: 3,
  image: "ubuntu:24.04",
  shell: "bash",
  terminals: [{ name: "main", user: "root", cwd: "/opt/app" }],
  objectives: [
    "Make /opt/app/deploy.sh executable",
    "Fix ownership of /opt/app/data so the appuser account owns it",
    "Remove world-write access from /opt/app/config.yml",
  ],
  instructions: `## Scenario

A colleague says their deployment fails with permission errors. You've been given shell access to \`/opt/app\`. Investigate with \`ls -la\` and fix what's broken:

1. \`deploy.sh\` should be executable by its owner, but isn't.
2. \`data/\` is meant to be owned by the service account \`appuser\`, but it's currently owned by root.
3. \`config.yml\` contains secrets and is currently world-writable — anyone on the box could tamper with it. Remove write access for group and others (\`640\` or stricter is appropriate, owner keeps read/write).

Use \`chmod\` and \`chown\` (and \`ls -la\` to check your work).`,
  tasks: [
    { id: "deploy_executable", description: "deploy.sh is executable by its owner" },
    { id: "data_owner", description: "data/ is owned by appuser" },
    { id: "config_not_world_writable", description: "config.yml is no longer world- or group-writable" },
  ],
  setupScript: `
useradd -r -m -s /usr/sbin/nologin appuser
mkdir -p /opt/app/data
cat > /opt/app/deploy.sh <<'EOF'
#!/bin/bash
echo "Deploying application..."
EOF
cat > /opt/app/config.yml <<'EOF'
database:
  host: localhost
  password: "changeme"
EOF
chmod 644 /opt/app/deploy.sh
chown root:root -R /opt/app/data
chmod 666 /opt/app/config.yml
`,
  verifyScript: `
if [ -x /opt/app/deploy.sh ]; then
  echo "CHECK:deploy_executable:PASS:deploy.sh is executable."
else
  echo "CHECK:deploy_executable:FAIL:deploy.sh is still not executable. Try chmod +x /opt/app/deploy.sh."
fi

OWNER=$(stat -c %U /opt/app/data 2>/dev/null)
if [ "$OWNER" = "appuser" ]; then
  echo "CHECK:data_owner:PASS:/opt/app/data is owned by appuser."
else
  echo "CHECK:data_owner:FAIL:/opt/app/data is owned by '$OWNER', expected appuser. Try chown appuser /opt/app/data."
fi

PERM=$(stat -c %A /opt/app/config.yml 2>/dev/null)
GROUP_W=$(echo "$PERM" | cut -c6)
OTHER_W=$(echo "$PERM" | cut -c9)
if [ "$GROUP_W" != "w" ] && [ "$OTHER_W" != "w" ]; then
  echo "CHECK:config_not_world_writable:PASS:config.yml is no longer group/world-writable ($PERM)."
else
  echo "CHECK:config_not_world_writable:FAIL:config.yml is still writable by group or others ($PERM). Try chmod 640 /opt/app/config.yml."
fi
`,
};
