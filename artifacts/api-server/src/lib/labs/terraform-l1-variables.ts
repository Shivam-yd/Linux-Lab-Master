import type { LabDefinition } from "./types";

export const terraformL1Variables: LabDefinition = {
  id: "terraform-l1-variables",
  track: "terraform",
  level: 1,
  title: "Lab 04: Variables",
  category: "Infrastructure as Code",
  difficulty: "beginner",
  summary:
    "Eliminate hardcoded values by introducing input variables with explicit types and defaults, then override one at apply time.",
  estimatedMinutes: 20,
  order: 23,
  image: "hashicorp/terraform:1.9",
  entrypoint: ["sleep", "infinity"],
  shell: "sh",
  terminals: [{ name: "main", user: "root", cwd: "/root/tf-lab" }],
  objectives: [
    "Define at least three input variables in variables.tf",
    "Assign an explicit type to every variable",
    "Provide a default value for at least one variable",
    "Reference variables inside a resource block using var.<name>",
    "Override a variable at apply time with -var flag",
  ],
  instructions: `## Scenario

The same Terraform configuration will be deployed to development, staging, and production. Remove all hardcoded values by introducing input variables so the same code works across every environment.

Working directory: \`/root/tf-lab\`

**Tip — no text editor installed.** Use heredocs:
\`\`\`sh
cat > variables.tf <<'EOF'
# HCL here
EOF
\`\`\`

---

## Steps

### 1 — Define input variables (variables.tf)

Create \`variables.tf\` with three variables covering the most common environment configuration values:

\`\`\`hcl
variable "environment" {
  type    = string
  default = "dev"
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}

variable "instance_count" {
  type    = number
  default = 1
}
\`\`\`

### 2 — Use variables in main.tf

Reference variables with \`var.<name>\`:

\`\`\`hcl
terraform {
  required_version = ">= 1.0"
}

resource "terraform_data" "config" {
  input = {
    environment = var.environment
    instance    = var.instance_type
    count       = var.instance_count
  }
}
\`\`\`

### 3 — Apply with defaults

\`\`\`sh
terraform init
terraform apply -auto-approve
\`\`\`

### 4 — Override a variable at apply time

\`\`\`sh
terraform apply -auto-approve -var="environment=staging"
\`\`\`

Notice how Terraform detects the input changed and updates the resource in place.

### 5 — Try other override methods

Variables can also be set via environment variables:
\`\`\`sh
TF_VAR_environment=prod terraform apply -auto-approve
\`\`\`

Or via a \`terraform.tfvars\` file:
\`\`\`sh
cat > terraform.tfvars <<'EOF'
environment    = "production"
instance_count = 3
EOF
terraform apply -auto-approve
\`\`\``,
  tasks: [
    {
      id: "variables_defined",
      description: "variables.tf defines at least three variable blocks",
    },
    {
      id: "types_assigned",
      description: "Every variable in variables.tf has an explicit type = attribute",
    },
    {
      id: "default_provided",
      description: "At least one variable has a default = value",
    },
    {
      id: "variables_used",
      description: "main.tf references at least one var.<name> expression inside a resource",
    },
    {
      id: "apply_succeeded",
      description: "terraform apply has run and state records at least one managed resource",
    },
  ],
  setupScript: `
mkdir -p /root/tf-lab
`,
  verifyScript: `
LAB=/root/tf-lab
VARS="$LAB/variables.tf"
MAIN="$LAB/main.tf"

# Task 1: at least 3 variable blocks in variables.tf
VAR_COUNT=0
if [ -f "$VARS" ]; then
  VAR_COUNT=$(grep -v '^[[:space:]]*#' "$VARS" | grep -cE '^[[:space:]]*variable[[:space:]]+"' 2>/dev/null)
fi
if [ "$VAR_COUNT" -ge 3 ]; then
  echo "CHECK:variables_defined:PASS:Found $VAR_COUNT variable block(s) in variables.tf."
else
  echo "CHECK:variables_defined:FAIL:Only $VAR_COUNT variable(s) found. Define at least 3 variable blocks in variables.tf."
fi

# Task 2: every variable has a type =
TOTAL_VARS=0
TYPED_VARS=0
if [ -f "$VARS" ]; then
  TOTAL_VARS=$(grep -v '^[[:space:]]*#' "$VARS" | grep -cE '^[[:space:]]*variable[[:space:]]+"' 2>/dev/null)
  TYPED_VARS=$(grep -v '^[[:space:]]*#' "$VARS" | grep -cE '^[[:space:]]*type[[:space:]]*=' 2>/dev/null)
fi
if [ "$TOTAL_VARS" -ge 3 ] && [ "$TYPED_VARS" -ge "$TOTAL_VARS" ]; then
  echo "CHECK:types_assigned:PASS:All $TOTAL_VARS variable(s) have an explicit type."
elif [ "$TYPED_VARS" -eq 0 ]; then
  echo "CHECK:types_assigned:FAIL:No type = attribute found in any variable. Add type = string (or number/bool) to each variable block."
else
  echo "CHECK:types_assigned:FAIL:Only $TYPED_VARS of $TOTAL_VARS variable(s) have a type. Every variable must declare a type."
fi

# Task 3: at least one default =
HAS_DEFAULT=0
if [ -f "$VARS" ]; then
  grep -v '^[[:space:]]*#' "$VARS" | grep -qE '^[[:space:]]*default[[:space:]]*=' && HAS_DEFAULT=1
fi
if [ "$HAS_DEFAULT" -eq 1 ]; then
  echo "CHECK:default_provided:PASS:At least one variable has a default value."
else
  echo "CHECK:default_provided:FAIL:No default = found in variables.tf. Add a default to at least one variable, e.g.: default = \"dev\""
fi

# Task 4: main.tf references var.
HAS_VAR_REF=0
if [ -f "$MAIN" ]; then
  grep -v '^[[:space:]]*#' "$MAIN" | grep -qE 'var\.[a-zA-Z_]' && HAS_VAR_REF=1
fi
if [ "$HAS_VAR_REF" -eq 1 ]; then
  echo "CHECK:variables_used:PASS:var.<name> reference found in main.tf."
else
  echo "CHECK:variables_used:FAIL:No var.<name> reference found in main.tf. Use your variables inside the resource block, e.g.: input = var.environment"
fi

# Task 5: state has managed resources
STATE="$LAB/terraform.tfstate"
if [ -f "$STATE" ]; then
  MANAGED=$(grep -c '"mode":[[:space:]]*"managed"' "$STATE" 2>/dev/null)
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
