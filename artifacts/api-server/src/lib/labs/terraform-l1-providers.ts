import type { LabDefinition } from "./types";

export const terraformL1Providers: LabDefinition = {
  id: "terraform-l1-providers",
  track: "terraform",
  level: 1,
  title: "Lab 02: Providers",
  category: "Infrastructure as Code",
  difficulty: "beginner",
  summary:
    "Declare the terraform block, pin the required Terraform version, configure a provider block, and verify provider installation with terraform init.",
  estimatedMinutes: 20,
  order: 21,
  image: "hashicorp/terraform:1.9",
  entrypoint: ["sleep", "infinity"],
  shell: "sh",
  terminals: [{ name: "main", user: "root", cwd: "/root/tf-lab" }],
  objectives: [
    "Declare a terraform {} block with required_version",
    "Add a required_providers block naming the provider and version constraint",
    "Write a provider configuration block",
    "Initialise provider plugins with terraform init",
    "Apply the configuration successfully",
  ],
  instructions: `## Scenario

Your team wants every Terraform project to explicitly declare its provider configuration to ensure consistency across environments. You need to add a proper \`terraform\` block with version constraints and a provider declaration before anyone writes another line of HCL.

Working directory: \`/root/tf-lab\`

**Tip — no text editor installed.** Use heredocs:
\`\`\`sh
cat > main.tf <<'EOF'
# HCL here
EOF
\`\`\`

---

## Steps

### 1 — Declare the terraform block

The \`terraform {}\` block is where you set the minimum Terraform version and list every provider the configuration needs.

\`\`\`hcl
terraform {
  required_version = ">= 1.0"

  required_providers {
    terraform = {
      source  = "terraform.io/builtin/terraform"
      version = ">= 1.0"
    }
  }
}
\`\`\`

> **Note:** \`terraform_data\` is a built-in resource — its provider (\`terraform.io/builtin/terraform\`) ships inside the Terraform binary and does not need to be downloaded.

### 2 — Add a provider block

Even when using a built-in provider it is good practice to include a provider block so future engineers know the configuration is intentional:

\`\`\`hcl
provider "terraform" {}
\`\`\`

### 3 — Declare a resource

\`\`\`hcl
resource "terraform_data" "demo" {
  input = "provider lab"
}
\`\`\`

### 4 — Initialise and apply

\`\`\`sh
terraform init
terraform providers          # inspect what was installed
terraform validate
terraform apply -auto-approve
\`\`\`

After \`init\`, \`terraform providers\` lists every provider Terraform resolved. The \`.terraform.lock.hcl\` lock file pins the exact versions so the build is reproducible.`,
  tasks: [
    {
      id: "terraform_block",
      description: "main.tf contains a terraform {} block",
    },
    {
      id: "required_version_set",
      description: "The terraform block includes a required_version constraint",
    },
    {
      id: "init_done",
      description: "terraform init has been run (.terraform.lock.hcl exists)",
    },
    {
      id: "apply_succeeded",
      description: "terraform apply has run and the state file records at least one managed resource",
    },
  ],
  setupScript: `
mkdir -p /root/tf-lab
`,
  verifyScript: `
LAB=/root/tf-lab
MAIN="$LAB/main.tf"

# Task 1: terraform {} block present in any .tf file
HAS_TF_BLOCK=0
for f in "$LAB"/*.tf; do
  [ -f "$f" ] || continue
  grep -v '^[[:space:]]*#' "$f" | grep -qE '^[[:space:]]*terraform[[:space:]]*\{' && HAS_TF_BLOCK=1 && break
done
if [ "$HAS_TF_BLOCK" -eq 1 ]; then
  echo "CHECK:terraform_block:PASS:terraform {} block found."
else
  echo "CHECK:terraform_block:FAIL:No terraform {} block found. Add one to main.tf: terraform { required_version = \">= 1.0\" }"
fi

# Task 2: required_version inside the terraform block
HAS_REQ_VER=0
for f in "$LAB"/*.tf; do
  [ -f "$f" ] || continue
  grep -v '^[[:space:]]*#' "$f" | grep -qE 'required_version[[:space:]]*=' && HAS_REQ_VER=1 && break
done
if [ "$HAS_REQ_VER" -eq 1 ]; then
  echo "CHECK:required_version_set:PASS:required_version constraint found."
else
  echo "CHECK:required_version_set:FAIL:required_version not found. Add: required_version = \">= 1.0\" inside the terraform {} block."
fi

# Task 3: .terraform.lock.hcl exists
if [ -f "$LAB/.terraform.lock.hcl" ]; then
  echo "CHECK:init_done:PASS:.terraform.lock.hcl exists — terraform init has been run."
else
  echo "CHECK:init_done:FAIL:.terraform.lock.hcl not found. Run: terraform init"
fi

# Task 4: state has at least one managed resource
STATE="$LAB/terraform.tfstate"
if [ -f "$STATE" ]; then
  MANAGED=$(grep -c '"mode":[[:space:]]*"managed"' "$STATE" 2>/dev/null || echo 0)
  if [ "$MANAGED" -gt 0 ]; then
    echo "CHECK:apply_succeeded:PASS:terraform.tfstate records $MANAGED managed resource(s)."
  else
    echo "CHECK:apply_succeeded:FAIL:State file has no managed resources. Run: terraform apply -auto-approve"
  fi
else
  echo "CHECK:apply_succeeded:FAIL:No terraform.tfstate found. Run: terraform init && terraform apply -auto-approve"
fi
`,
};
