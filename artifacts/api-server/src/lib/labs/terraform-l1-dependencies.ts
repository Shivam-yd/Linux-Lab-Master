import type { LabDefinition } from "./types";

export const terraformL1Dependencies: LabDefinition = {
  id: "terraform-l1-dependencies",
  track: "terraform",
  level: 1,
  title: "Lab 09: Expressions & Dependencies",
  category: "Infrastructure as Code",
  difficulty: "beginner",
  summary:
    "Manage resource dependencies correctly — reference attributes between resources to create implicit dependencies, then add an explicit depends_on where needed.",
  estimatedMinutes: 20,
  order: 28,
  image: "hashicorp/terraform:1.9",
  entrypoint: ["sleep", "infinity"],
  shell: "sh",
  terminals: [{ name: "main", user: "root", cwd: "/root/tf-lab" }],
  objectives: [
    "Create two related resources in main.tf",
    "Reference an attribute of the first resource inside the second (implicit dependency)",
    "Add an explicit depends_on to a third resource",
    "Apply and verify all resources are created in the correct order",
  ],
  instructions: `## Scenario

Your infrastructure contains resources that depend on one another — a replica server needs its primary to exist first, and a monitoring agent must only start after the application server is running. Configure Terraform to manage resource dependencies correctly, both implicitly (via attribute references) and explicitly (via \`depends_on\`).

Working directory: \`/root/tf-lab\`

**Tip — no text editor installed.** Use heredocs:
\`\`\`sh
cat > main.tf <<'EOF'
# HCL here
EOF
\`\`\`

---

## Steps

### 1 — Implicit dependency via attribute reference

When resource B references an attribute of resource A, Terraform automatically creates A before B. This is an **implicit dependency** — no extra configuration required.

\`\`\`hcl
terraform {
  required_version = ">= 1.0"
}

# Primary server — created first
resource "terraform_data" "primary" {
  input = "primary-server"
}

# Replica references the primary's computed output — implicit dependency
resource "terraform_data" "replica" {
  input = "replica-of-\${terraform_data.primary.output}"
}
\`\`\`

Terraform resolves the graph: \`primary\` → \`replica\`.

### 2 — Explicit dependency with depends_on

Sometimes a resource depends on another but doesn't reference any of its attributes. Use \`depends_on\` to declare the relationship explicitly:

\`\`\`hcl
# Monitoring agent — depends on primary but doesn't use its attributes
resource "terraform_data" "monitor" {
  input = "monitor-agent"

  depends_on = [terraform_data.primary]
}
\`\`\`

### 3 — Apply and observe the order

\`\`\`sh
terraform init
terraform apply -auto-approve
\`\`\`

Read the plan output — Terraform shows resource creation in dependency order. Confirm all three are in state:

\`\`\`sh
terraform state list
\`\`\`

### 4 — Inspect the dependency graph (optional)

\`\`\`sh
terraform graph
\`\`\`

This outputs a DOT-format graph showing every dependency edge Terraform computed.`,
  tasks: [
    {
      id: "multiple_resources",
      description: "main.tf declares at least two terraform_data resource blocks",
    },
    {
      id: "attribute_reference",
      description:
        "A resource references another resource's attribute (terraform_data.<name>.output) creating an implicit dependency",
    },
    {
      id: "depends_on_present",
      description: "At least one resource block contains a depends_on argument",
    },
    {
      id: "apply_succeeded",
      description: "terraform apply has run and state records at least two managed resources",
    },
  ],
  setupScript: `
mkdir -p /root/tf-lab
`,
  verifyScript: `
LAB=/root/tf-lab
MAIN="$LAB/main.tf"

# Task 1: at least 2 terraform_data resources
COUNT=0
if [ -f "$MAIN" ]; then
  COUNT=$(grep -v '^[[:space:]]*#' "$MAIN" | grep -cE 'resource[[:space:]]+"terraform_data"' 2>/dev/null)
fi
if [ "$COUNT" -ge 2 ]; then
  echo "CHECK:multiple_resources:PASS:Found $COUNT terraform_data resource block(s)."
else
  echo "CHECK:multiple_resources:FAIL:Only $COUNT terraform_data resource(s). Declare at least 2 resource blocks in main.tf."
fi

# Task 2: a resource references another resource's .output attribute
HAS_REF=0
if [ -f "$MAIN" ]; then
  grep -v '^[[:space:]]*#' "$MAIN" | grep -qE 'terraform_data\.[a-zA-Z_]+\.output' && HAS_REF=1
fi
if [ "$HAS_REF" -eq 1 ]; then
  echo "CHECK:attribute_reference:PASS:Implicit dependency found — terraform_data.<name>.output referenced inside another resource."
else
  echo "CHECK:attribute_reference:FAIL:No resource attribute reference found. Inside a resource, reference another resource's output, e.g.: input = terraform_data.primary.output"
fi

# Task 3: depends_on present
HAS_DEPENDS=0
if [ -f "$MAIN" ]; then
  grep -v '^[[:space:]]*#' "$MAIN" | grep -qE 'depends_on[[:space:]]*=' && HAS_DEPENDS=1
fi
if [ "$HAS_DEPENDS" -eq 1 ]; then
  echo "CHECK:depends_on_present:PASS:depends_on found in main.tf."
else
  echo "CHECK:depends_on_present:FAIL:No depends_on found. Add an explicit dependency to at least one resource: depends_on = [terraform_data.primary]"
fi

# Task 4: state has at least 2 managed resources
STATE="$LAB/terraform.tfstate"
if [ -f "$STATE" ]; then
  MANAGED=$(grep -c '"mode":[[:space:]]*"managed"' "$STATE" 2>/dev/null)
  if [ "$MANAGED" -ge 2 ]; then
    echo "CHECK:apply_succeeded:PASS:terraform.tfstate records $MANAGED managed resource(s)."
  else
    echo "CHECK:apply_succeeded:FAIL:Only $MANAGED managed resource(s) in state, need at least 2. Run: terraform apply -auto-approve"
  fi
else
  echo "CHECK:apply_succeeded:FAIL:No terraform.tfstate found. Run: terraform init && terraform apply -auto-approve"
fi
`,
};
