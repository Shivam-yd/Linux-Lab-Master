import type { LabDefinition } from "./types";

export const terraformL1Resources: LabDefinition = {
  id: "terraform-l1-resources",
  track: "terraform",
  level: 1,
  title: "Lab 03: Resources",
  category: "Infrastructure as Code",
  difficulty: "beginner",
  summary:
    "Provision multiple infrastructure resources, give each a unique name, modify one, verify Terraform tracks all of them in state, then destroy.",
  estimatedMinutes: 20,
  order: 22,
  image: "hashicorp/terraform:1.9",
  entrypoint: ["sleep", "infinity"],
  shell: "sh",
  terminals: [{ name: "main", user: "root", cwd: "/root/tf-lab" }],
  objectives: [
    "Declare at least three distinct resource blocks in main.tf",
    "Give each resource a unique label",
    "Apply and verify Terraform tracks all resources in state",
    "Modify one resource's input and apply the change",
    "Destroy all resources and confirm state is clean",
  ],
  instructions: `## Scenario

Your DevOps team has asked you to provision multiple infrastructure resources using Terraform instead of creating them manually. You'll declare three resources, apply them, then modify one to practise in-place updates, and finally tear everything down.

Working directory: \`/root/tf-lab\`

**Tip — no text editor installed.** Use heredocs:
\`\`\`sh
cat > main.tf <<'EOF'
# HCL here
EOF
\`\`\`

---

## Steps

### 1 — Declare multiple resources

Each Terraform resource has **two labels**: the resource type and a unique name you choose.  
\`resource "<TYPE>" "<NAME>" { ... }\`

Create \`main.tf\` with three \`terraform_data\` resources — one for each tier of a typical web stack:

\`\`\`hcl
terraform {
  required_version = ">= 1.0"
}

resource "terraform_data" "web" {
  input = "nginx-server"
}

resource "terraform_data" "app" {
  input = "node-backend"
}

resource "terraform_data" "db" {
  input = "postgres-primary"
}
\`\`\`

### 2 — Apply the configuration

\`\`\`sh
terraform init
terraform apply -auto-approve
\`\`\`

Confirm all three resources appear in state:

\`\`\`sh
terraform state list
\`\`\`

### 3 — Modify one resource

Edit the \`web\` resource to change its input value (simulating an in-place config update):

\`\`\`sh
cat > main.tf <<'EOF'
terraform {
  required_version = ">= 1.0"
}

resource "terraform_data" "web" {
  input = "nginx-server-v2"   # changed
}

resource "terraform_data" "app" {
  input = "node-backend"
}

resource "terraform_data" "db" {
  input = "postgres-primary"
}
EOF
terraform apply -auto-approve
\`\`\`

### 4 — Destroy all resources

\`\`\`sh
terraform destroy -auto-approve
\`\`\`

Verify the state is empty:

\`\`\`sh
terraform state list   # should print nothing
\`\`\``,
  tasks: [
    {
      id: "multiple_resources",
      description: "main.tf declares at least three terraform_data resource blocks",
    },
    {
      id: "unique_labels",
      description: "Each terraform_data resource has a different label (unique second argument)",
    },
    {
      id: "apply_all_resources",
      description: "terraform apply has run and state records at least three managed resources",
    },
    {
      id: "destroy_done",
      description: "terraform destroy has run and state contains no managed resources",
    },
  ],
  setupScript: `
mkdir -p /root/tf-lab
`,
  verifyScript: `
LAB=/root/tf-lab
MAIN="$LAB/main.tf"

# Task 1: at least 3 terraform_data resource blocks
COUNT=0
if [ -f "$MAIN" ]; then
  COUNT=$(grep -v '^[[:space:]]*#' "$MAIN" | grep -cE 'resource[[:space:]]+"terraform_data"' 2>/dev/null || echo 0)
fi
if [ "$COUNT" -ge 3 ]; then
  echo "CHECK:multiple_resources:PASS:Found $COUNT terraform_data resource block(s) — at least 3 required."
else
  echo "CHECK:multiple_resources:FAIL:Only $COUNT terraform_data resource(s) found. Declare at least 3 distinct resource blocks in main.tf."
fi

# Task 2: unique labels — extract all labels and check for duplicates
if [ -f "$MAIN" ]; then
  LABELS=$(grep -v '^[[:space:]]*#' "$MAIN" | grep -oE 'resource[[:space:]]+"terraform_data"[[:space:]]+"[^"]+"' | grep -oE '"[^"]*"$' | tr -d '"' | sort)
  TOTAL=$(echo "$LABELS" | wc -l)
  UNIQ=$(echo "$LABELS" | sort -u | wc -l)
  if [ "$TOTAL" -ge 3 ] && [ "$TOTAL" -eq "$UNIQ" ]; then
    echo "CHECK:unique_labels:PASS:All $TOTAL terraform_data resources have unique labels."
  else
    echo "CHECK:unique_labels:FAIL:Duplicate resource labels detected or fewer than 3 resources. Each resource block must have a unique second label."
  fi
else
  echo "CHECK:unique_labels:FAIL:main.tf not found."
fi

# Task 3: state has at least 3 managed resources
STATE="$LAB/terraform.tfstate"
if [ -f "$STATE" ]; then
  MANAGED=$(grep -c '"mode":[[:space:]]*"managed"' "$STATE" 2>/dev/null || echo 0)
  if [ "$MANAGED" -ge 3 ]; then
    echo "CHECK:apply_all_resources:PASS:terraform.tfstate records $MANAGED managed resource(s)."
  else
    echo "CHECK:apply_all_resources:FAIL:Only $MANAGED managed resource(s) in state, need at least 3. Run: terraform apply -auto-approve"
  fi
else
  echo "CHECK:apply_all_resources:FAIL:No terraform.tfstate found. Run: terraform init && terraform apply -auto-approve"
fi

# Task 4: destroy done — zero managed resources in state
if [ -f "$STATE" ]; then
  MANAGED=$(grep -c '"mode":[[:space:]]*"managed"' "$STATE" 2>/dev/null || echo 0)
  if [ "$MANAGED" -eq 0 ]; then
    echo "CHECK:destroy_done:PASS:No managed resources in state — terraform destroy succeeded."
  else
    echo "CHECK:destroy_done:FAIL:$MANAGED resource(s) still managed. Run: terraform destroy -auto-approve"
  fi
else
  echo "CHECK:destroy_done:FAIL:terraform.tfstate not found. Apply first, then run: terraform destroy -auto-approve"
fi
`,
};
