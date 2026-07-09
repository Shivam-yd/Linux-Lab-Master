import type { LabDefinition } from "./types";

export const userGroupManagement: LabDefinition = {
  id: "user-group-management",
  track: "linux",
  level: 2,
  title: "Linux User & Group Management",
  category: "System Administration",
  difficulty: "beginner",
  summary:
    "Create a shared group for a small dev team, add the right users to it, and lock down a project directory so only the team can use it.",
  estimatedMinutes: 15,
  order: 2,
  image: "ubuntu:24.04",
  shell: "bash",
  terminals: [{ name: "main", user: "root", cwd: "/root" }],
  objectives: [
    "Create a 'devteam' group",
    "Create user 'alice' and add her to devteam",
    "Add the existing user 'bob' to devteam",
    "Make /srv/project owned by the devteam group with group write access",
  ],
  instructions: `## Scenario

A new engineer, **alice**, is joining a project. An existing engineer, **bob**, already has an account. Both need shared write access to a project directory at \`/srv/project\`, and nobody outside the team should be able to write to it.

## Steps

1. Create a group called \`devteam\`.
2. Create a new user \`alice\` with a home directory, and add her to \`devteam\`.
3. Add the existing user \`bob\` to \`devteam\` (don't recreate him).
4. Change the group ownership of \`/srv/project\` to \`devteam\`, and make sure the group has write permission on it (\`rwxrwx---\` is a good target, or \`chmod g+w\`).

You're working as root in a single sandbox, so use \`groupadd\`, \`useradd\`, \`usermod -aG\`, \`chgrp\`, and \`chmod\`.`,
  tasks: [
    { id: "group_exists", description: "A group named devteam exists" },
    { id: "alice_exists", description: "User alice exists and belongs to devteam" },
    { id: "bob_in_group", description: "User bob belongs to devteam" },
    {
      id: "project_perms",
      description: "/srv/project is group-owned by devteam and group-writable",
    },
  ],
  setupScript: `
useradd -m -s /bin/bash bob
mkdir -p /srv/project
chmod 755 /srv/project
echo "Project scaffold. Only the dev team should be able to write here." > /srv/project/README.md
`,
  verifyScript: `
if getent group devteam >/dev/null; then
  echo "CHECK:group_exists:PASS:The devteam group exists."
else
  echo "CHECK:group_exists:FAIL:No group named devteam was found. Run groupadd devteam."
fi

if id alice >/dev/null 2>&1 && id -nG alice 2>/dev/null | grep -qw devteam; then
  echo "CHECK:alice_exists:PASS:alice exists and is a member of devteam."
else
  echo "CHECK:alice_exists:FAIL:alice either doesn't exist or isn't in devteam yet."
fi

if id -nG bob 2>/dev/null | grep -qw devteam; then
  echo "CHECK:bob_in_group:PASS:bob is a member of devteam."
else
  echo "CHECK:bob_in_group:FAIL:bob is not in devteam. Use usermod -aG devteam bob."
fi

GRP=$(stat -c %G /srv/project 2>/dev/null)
PERM=$(stat -c %A /srv/project 2>/dev/null)
if [ "$GRP" = "devteam" ] && echo "$PERM" | cut -c6 | grep -q w; then
  echo "CHECK:project_perms:PASS:/srv/project is owned by group devteam and is group-writable."
else
  echo "CHECK:project_perms:FAIL:/srv/project group is '$GRP' with perms '$PERM' -- expected group devteam with group write enabled."
fi
`,
};
