import type { LabDefinition } from "./types";

export const sshPasswordless: LabDefinition = {
  id: "ssh-passwordless",
  title: "Passwordless SSH Between Two Servers",
  category: "Networking",
  difficulty: "beginner",
  summary:
    "Generate an SSH keypair on server1 and configure server2 to accept it, so student1 can log in without typing a password.",
  estimatedMinutes: 15,
  order: 1,
  image: "rastasheep/ubuntu-sshd:18.04",
  shell: "bash",
  terminals: [
    { name: "server1", user: "student1", cwd: "/home/student1" },
    { name: "server2", user: "student2", cwd: "/home/student2" },
  ],
  objectives: [
    "Generate an SSH keypair for student1 on server1",
    "Install the public key in student2's authorized_keys on server2",
    "Confirm student1 can SSH into server2 as student2 without a password prompt",
  ],
  instructions: `## Scenario

Your team runs a nightly job on **server1** that needs to copy files to **server2** unattended. Right now, SSH from server1 to server2 requires typing student2's password every time — that will not work in a cron job.

Your task: set up **key-based, passwordless SSH** from \`student1@server1\` to \`student2@server2\`.

## Steps

1. On the **server1** terminal, generate an SSH keypair for \`student1\` (\`ssh-keygen\`). Accept the default location and leave the passphrase empty — a passphrase would defeat the purpose of unattended login.
2. Get the public key (\`~/.ssh/id_rsa.pub\` or similar) onto **server2**, into \`/home/student2/.ssh/authorized_keys\`. You can copy the key by hand (e.g. \`cat\`/\`echo\` it into a file on server2's terminal) or use \`ssh-copy-id\` if available.
3. Make sure the permissions on \`student2\`'s \`.ssh\` directory and \`authorized_keys\` file are correct (SSH is picky: \`700\` for the directory, \`600\` for the file).
4. From **server1**, run \`ssh student2@server2\` and confirm you land in a shell with no password prompt.

Both terminals are two different Linux user accounts sharing this sandbox, standing in for two separate servers named \`server1\` and \`server2\`.`,
  tasks: [
    { id: "keypair", description: "An SSH keypair exists for student1 on server1" },
    {
      id: "authorized_keys",
      description: "student1's public key is installed in student2's authorized_keys on server2",
    },
    {
      id: "passwordless_login",
      description: "ssh student2@server2 from server1 succeeds without a password prompt",
    },
  ],
  setupScript: `
useradd -m -s /bin/bash student1
useradd -m -s /bin/bash student2
echo "student1:student1" | chpasswd
echo "student2:student2" | chpasswd
echo "127.0.0.1 server1" >> /etc/hosts
echo "127.0.0.1 server2" >> /etc/hosts
service ssh start || /usr/sbin/sshd
`,
  verifyScript: `
if su - student1 -c 'test -f ~/.ssh/id_rsa || test -f ~/.ssh/id_ed25519 || test -f ~/.ssh/id_ecdsa'; then
  echo "CHECK:keypair:PASS:Found an SSH private key for student1."
else
  echo "CHECK:keypair:FAIL:No SSH keypair found in /home/student1/.ssh. Run ssh-keygen as student1 on server1."
fi

if su - student2 -c 'test -s ~/.ssh/authorized_keys'; then
  echo "CHECK:authorized_keys:PASS:student2's authorized_keys file exists and is not empty."
else
  echo "CHECK:authorized_keys:FAIL:student2's ~/.ssh/authorized_keys is missing or empty."
fi

OUT=$(su - student1 -c 'timeout 5 ssh -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=3 student2@server2 echo LOGIN_OK' 2>&1)
if echo "$OUT" | grep -q "LOGIN_OK"; then
  echo "CHECK:passwordless_login:PASS:ssh student2@server2 succeeded with no password prompt."
else
  MSG=$(echo "$OUT" | tr '\\n' ' ' | cut -c1-180)
  echo "CHECK:passwordless_login:FAIL:ssh student2@server2 did not log in without a password. Output: $MSG"
fi
`,
};
