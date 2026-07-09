import type { LabDefinition } from "./types";

export const terraformL1State: LabDefinition = {
  id: "terraform-l1-state",
  track: "terraform",
  level: 1,
  title: "Lab 07: Terraform State",
  category: "Infrastructure as Code",
  difficulty: "beginner",
  summary:
    "Explore how Terraform tracks infrastructure using the state file — deploy resources, inspect state with CLI commands, and understand what happens when resources are destroyed.",
  estimatedMinutes: 20,
  order: 26,
  image: "hashicorp/terraform:1.9",
  entrypoint: ["sleep", "infinity"],
  shell: "sh",
  terminals: [{ name: "main", user: "root", cwd: "/root/tf-lab" }],
  objectives: [
    "Deploy two resources and confirm state is written",
    "List all managed resources with terraform state list",
    "Inspect detailed state for one resource with terraform state show",
    "Save the state output to files for review",
    "Destroy the infrastructure and verify state is empty",
  ],
  instructions: `## Scenario

A teammate accidentally removed a managed resource outside of Terraform. Before you can recover it, you need to understand how Terraform tracks infrastructure using the state file — what's in it, how to read it, and what it looks like after destruction.

Working directory: \`/root/tf-lab\`

**Tip — no text editor installed.** Use heredocs:
\`\`\`sh
cat > main.tf <<'EOF'
# HCL here
EOF
\`\`\`

---

## Steps

### 1 — Deploy infrastructure (main.tf)

\`\`\`hcl
terraform {
  required_version = ">= 1.0"
}

resource "terraform_data" "server" {
  input = "web-server-01"
}

resource "terraform_data" "database" {
  input = "db-primary"
}
\`\`\`

\`\`\`sh
terraform init
terraform apply -auto-approve
\`\`\`

### 2 — Inspect the state

The raw state file is JSON — you can read it directly:
\`\`\`sh
cat terraform.tfstate
\`\`\`

Use the CLI to list all managed resources:
\`\`\`sh
terraform state list
\`\`\`

Save the output for review:
\`\`\`sh
terraform state list > state-list.txt
cat state-list.txt
\`\`\`

### 3 — Show detailed information for one resource

\`\`\`sh
terraform state show terraform_data.server
\`\`\`

Save it:
\`\`\`sh
terraform state show terraform_data.server > state-detail.txt
cat state-detail.txt
\`\`\`

The output shows every attribute Terraform tracks for that resource — its current values, provider, and dependency metadata.

### 4 — Destroy and observe the state change

\`\`\`sh
terraform destroy -auto-approve
cat terraform.tfstate          # resources array is now empty
terraform state list           # prints nothing
\`\`\`

The state file still exists after destroy — Terraform keeps it as a historical record — but the resources array is empty.`,
  tasks: [
    {
      id: "apply_succeeded",
      description: "terraform apply has run and state records at least two managed resources",
    },
    {
      id: "state_list_saved",
      description: "state-list.txt exists in /root/tf-lab (output of terraform state list)",
    },
    {
      id: "state_detail_saved",
      description: "state-detail.txt exists in /root/tf-lab (output of terraform state show)",
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
STATE="$LAB/terraform.tfstate"

# Task 1: state has at least 2 managed resources (from initial apply)
# Note: after destroy this will be 0 — tasks 1 and 4 are intentionally sequential.
# We check the state-list.txt as evidence of the apply step.
# Primary check: did terraform.tfstate ever have resources? Use state-list.txt as proof.
if [ -f "$LAB/state-list.txt" ] && [ -s "$LAB/state-list.txt" ]; then
  echo "CHECK:apply_succeeded:PASS:state-list.txt exists with content — terraform apply was run successfully before listing state."
elif [ -f "$STATE" ]; then
  MANAGED=$(grep -c '"mode":[[:space:]]*"managed"' "$STATE" 2>/dev/null || echo 0)
  if [ "$MANAGED" -ge 2 ]; then
    echo "CHECK:apply_succeeded:PASS:terraform.tfstate records $MANAGED managed resource(s)."
  else
    echo "CHECK:apply_succeeded:FAIL:State has $MANAGED managed resource(s); need at least 2. Run: terraform apply -auto-approve (make sure main.tf has 2 resources)."
  fi
else
  echo "CHECK:apply_succeeded:FAIL:No terraform.tfstate found. Run: terraform init && terraform apply -auto-approve"
fi

# Task 2: state-list.txt exists and is non-empty
if [ -f "$LAB/state-list.txt" ] && [ -s "$LAB/state-list.txt" ]; then
  echo "CHECK:state_list_saved:PASS:state-list.txt exists with content."
elif [ -f "$LAB/state-list.txt" ]; then
  echo "CHECK:state_list_saved:FAIL:state-list.txt exists but is empty. Run: terraform state list > state-list.txt (before destroy)."
else
  echo "CHECK:state_list_saved:FAIL:state-list.txt not found. Run: terraform state list > state-list.txt"
fi

# Task 3: state-detail.txt exists and is non-empty
if [ -f "$LAB/state-detail.txt" ] && [ -s "$LAB/state-detail.txt" ]; then
  echo "CHECK:state_detail_saved:PASS:state-detail.txt exists with content."
elif [ -f "$LAB/state-detail.txt" ]; then
  echo "CHECK:state_detail_saved:FAIL:state-detail.txt is empty. Run: terraform state show terraform_data.server > state-detail.txt (before destroy)."
else
  echo "CHECK:state_detail_saved:FAIL:state-detail.txt not found. Run: terraform state show terraform_data.server > state-detail.txt"
fi

# Task 4: destroy done — zero managed resources
if [ -f "$STATE" ]; then
  MANAGED=$(grep -c '"mode":[[:space:]]*"managed"' "$STATE" 2>/dev/null || echo 0)
  if [ "$MANAGED" -eq 0 ]; then
    echo "CHECK:destroy_done:PASS:No managed resources in state — terraform destroy succeeded."
  else
    echo "CHECK:destroy_done:FAIL:$MANAGED resource(s) still in state. Run: terraform destroy -auto-approve"
  fi
else
  echo "CHECK:destroy_done:FAIL:terraform.tfstate not found. Complete the apply and state inspection steps first, then run: terraform destroy -auto-approve"
fi
`,
};
