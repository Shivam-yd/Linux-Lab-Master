import type { LabDefinition } from "./types";

export const terraformL1Count: LabDefinition = {
  id: "terraform-l1-count",
  track: "terraform",
  level: 1,
  title: "Lab 10: count Meta-Argument",
  category: "Infrastructure as Code",
  difficulty: "beginner",
  summary:
    "Avoid duplicated resource blocks by using the count meta-argument to create multiple identical instances — and control the number with a variable.",
  estimatedMinutes: 20,
  order: 29,
  image: "hashicorp/terraform:1.9",
  entrypoint: ["sleep", "infinity"],
  shell: "sh",
  terminals: [{ name: "main", user: "root", cwd: "/root/tf-lab" }],
  objectives: [
    "Define a variable to control the number of instances",
    "Use count = var.<name> on a resource block",
    "Use count.index to give each instance a unique name",
    "Apply and verify all instances are created",
    "Scale the count up and down by changing the variable",
  ],
  instructions: `## Scenario

Your testing environment requires multiple identical server resources. Instead of copy-pasting resource blocks, use Terraform's \`count\` meta-argument to automate resource creation — and tie the number of instances to a variable so scaling is a one-line change.

Working directory: \`/root/tf-lab\`

**Tip — no text editor installed.** Use heredocs:
\`\`\`sh
cat > main.tf <<'EOF'
# HCL here
EOF
\`\`\`

---

## Steps

### 1 — Define a count variable (variables.tf)

\`\`\`hcl
variable "instance_count" {
  type        = number
  default     = 3
  description = "Number of server instances to create"
}
\`\`\`

### 2 — Use count on a resource (main.tf)

\`\`\`hcl
terraform {
  required_version = ">= 1.0"
}

resource "terraform_data" "server" {
  count = var.instance_count
  input = "server-\${count.index}"
}
\`\`\`

Each instance gets a unique index: \`server-0\`, \`server-1\`, \`server-2\`.  
Terraform names the instances \`terraform_data.server[0]\`, \`terraform_data.server[1]\`, etc.

### 3 — Output all instance values (outputs.tf)

\`\`\`hcl
output "server_names" {
  value = [for s in terraform_data.server : s.output]
}
\`\`\`

### 4 — Apply and verify

\`\`\`sh
terraform init
terraform apply -auto-approve
terraform state list       # shows server[0], server[1], server[2]
terraform output           # shows the list of server names
\`\`\`

### 5 — Scale up and observe the plan

\`\`\`sh
terraform apply -auto-approve -var="instance_count=5"
terraform state list       # now shows 5 instances
\`\`\`

### 6 — Scale down

\`\`\`sh
terraform apply -auto-approve -var="instance_count=2"
\`\`\`

Terraform destroys \`server[2]\`, \`server[3]\`, and \`server[4]\` — no manual cleanup required.`,
  tasks: [
    {
      id: "count_variable",
      description: "variables.tf defines a number variable to control the instance count",
    },
    {
      id: "count_used",
      description: "main.tf uses count = var.<name> on a terraform_data resource",
    },
    {
      id: "count_index_used",
      description: "main.tf uses count.index to differentiate instances",
    },
    {
      id: "apply_multiple",
      description: "terraform apply has run and state records at least three managed resources",
    },
  ],
  setupScript: `
mkdir -p /root/tf-lab
`,
  verifyScript: `
LAB=/root/tf-lab
VARS="$LAB/variables.tf"
MAIN="$LAB/main.tf"

# Task 1: variables.tf has a number variable for count
HAS_COUNT_VAR=0
if [ -f "$VARS" ]; then
  # Check for a variable with type = number
  grep -v '^[[:space:]]*#' "$VARS" | grep -qE 'type[[:space:]]*=[[:space:]]*number' && HAS_COUNT_VAR=1
fi
if [ "$HAS_COUNT_VAR" -eq 1 ]; then
  echo "CHECK:count_variable:PASS:A number variable found in variables.tf for controlling instance count."
else
  echo "CHECK:count_variable:FAIL:No number-type variable found in variables.tf. Add: variable \"instance_count\" { type = number; default = 3 }"
fi

# Task 2: count = used in a resource (referencing a var.)
HAS_COUNT=0
if [ -f "$MAIN" ]; then
  grep -v '^[[:space:]]*#' "$MAIN" | grep -qE '^[[:space:]]*count[[:space:]]*=' && HAS_COUNT=1
fi
if [ "$HAS_COUNT" -eq 1 ]; then
  echo "CHECK:count_used:PASS:count = found in main.tf."
else
  echo "CHECK:count_used:FAIL:No count = found in a resource block. Add count = var.instance_count to your terraform_data resource."
fi

# Task 3: count.index used
HAS_INDEX=0
if [ -f "$MAIN" ]; then
  grep -v '^[[:space:]]*#' "$MAIN" | grep -qE 'count\.index' && HAS_INDEX=1
fi
if [ "$HAS_INDEX" -eq 1 ]; then
  echo "CHECK:count_index_used:PASS:count.index found in main.tf."
else
  echo "CHECK:count_index_used:FAIL:count.index not found. Use it to give each instance a unique name, e.g.: input = \"server-\${count.index}\""
fi

# Task 4: state has at least 3 managed resources
STATE="$LAB/terraform.tfstate"
if [ -f "$STATE" ]; then
  MANAGED=$(grep -c '"mode":[[:space:]]*"managed"' "$STATE" 2>/dev/null)
  if [ "$MANAGED" -ge 3 ]; then
    echo "CHECK:apply_multiple:PASS:terraform.tfstate records $MANAGED managed resource(s) — count is working."
  else
    echo "CHECK:apply_multiple:FAIL:Only $MANAGED managed resource(s) in state, need at least 3. Run: terraform apply -auto-approve (default count is 3)."
  fi
else
  echo "CHECK:apply_multiple:FAIL:No terraform.tfstate found. Run: terraform init && terraform apply -auto-approve"
fi
`,
};
