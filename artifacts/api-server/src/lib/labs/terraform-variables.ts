import type { LabDefinition } from "./types";

export const terraformVariables: LabDefinition = {
  id: "terraform-variables",
  track: "terraform",
  level: 2,
  title: "Terraform Variables: Validation & Type Constraints",
  category: "Infrastructure as Code",
  difficulty: "intermediate",
  summary:
    "Level up your variable game — add type constraints, validation rules, sensitive flags, and use conditional expressions to build safer, more expressive Terraform configs.",
  estimatedMinutes: 25,
  order: 8,
  image: "hashicorp/terraform:1.9",
  entrypoint: ["sleep", "infinity"],
  shell: "sh",
  terminals: [{ name: "main", user: "root", cwd: "/root/tf-lab" }],
  objectives: [
    "Define a validated variable with a custom error message",
    "Mark a variable as sensitive",
    "Use a conditional expression to compute a derived local",
    "Apply the config and confirm the state file records the resource",
  ],
  instructions: `## Scenario

Your team's Terraform configs keep breaking because engineers pass invalid values — wrong environment names, negative port numbers, empty strings. Your task: harden the variable definitions with **type constraints**, **validation blocks**, and a **sensitive flag**, then use a **conditional expression** in a local.

Working directory: \`/root/tf-lab\`

**Tip**: use heredocs to write files (no text editor installed):
\`\`\`sh
cat > variables.tf <<'EOF'
# your HCL here
EOF
\`\`\`

---

## Steps

### 1 — variables.tf with validation

Define three variables:

| Name | Type | Default | Rule |
|---|---|---|---|
| \`environment\` | string | \`"dev"\` | must be one of: dev, staging, prod |
| \`port\` | number | \`8080\` | must be between 1024 and 65535 |
| \`db_password\` | string | *(required)* | sensitive = true |

\`\`\`hcl
variable "environment" {
  type    = string
  default = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod."
  }
}

variable "port" {
  type    = number
  default = 8080

  validation {
    condition     = var.port >= 1024 && var.port <= 65535
    error_message = "port must be between 1024 and 65535."
  }
}

variable "db_password" {
  type      = string
  sensitive = true
}
\`\`\`

### 2 — main.tf with conditional expression

Compute a \`locals\` block where \`is_production\` is \`true\` when \`environment == "prod"\`, and use that in a \`terraform_data\` resource:

\`\`\`hcl
locals {
  is_production = var.environment == "prod"
  config_label  = local.is_production ? "prod-strict" : "dev-relaxed"
}

resource "terraform_data" "app_config" {
  input = {
    label = local.config_label
    port  = var.port
  }
}
\`\`\`

### 3 — outputs.tf

\`\`\`hcl
output "config_label" {
  value = terraform_data.app_config.output.label
}

output "port" {
  value = terraform_data.app_config.output.port
}
\`\`\`

### 4 — Apply

\`\`\`sh
terraform init
terraform validate
terraform apply -auto-approve \\
  -var="db_password=s3cr3t" \\
  -var="environment=staging" \\
  -var="port=3000"
\`\`\`

Try applying with an **invalid** value first to see validation fire:
\`\`\`sh
terraform apply -auto-approve -var="db_password=x" -var="environment=qa"
# should error: environment must be dev, staging, or prod
\`\`\``,
  tasks: [
    {
      id: "env_var_validated",
      description:
        "variables.tf defines 'environment' with a validation block checking allowed values",
    },
    {
      id: "sensitive_var",
      description: "variables.tf defines 'db_password' with sensitive = true",
    },
    {
      id: "conditional_local",
      description:
        "main.tf uses a conditional expression (? :) in a locals block",
    },
    {
      id: "apply_succeeded",
      description:
        "terraform apply has been run and state records at least one managed resource",
    },
  ],
  setupScript: `
mkdir -p /root/tf-lab
`,
  verifyScript: `
LAB=/root/tf-lab

# Task 1: environment variable has a validation block
VARS="$LAB/variables.tf"
HAS_ENV_VAR=0
HAS_VALIDATION=0
if [ -f "$VARS" ]; then
  grep -v '^[[:space:]]*#' "$VARS" | grep -qE 'variable[[:space:]]+"environment"' && HAS_ENV_VAR=1
  grep -v '^[[:space:]]*#' "$VARS" | grep -qE 'validation[[:space:]]*\{' && HAS_VALIDATION=1
fi
if [ "$HAS_ENV_VAR" -eq 1 ] && [ "$HAS_VALIDATION" -eq 1 ]; then
  echo "CHECK:env_var_validated:PASS:environment variable with validation block found."
elif [ "$HAS_ENV_VAR" -eq 0 ]; then
  echo "CHECK:env_var_validated:FAIL:variables.tf is missing variable \"environment\". Add it with a validation block."
else
  echo "CHECK:env_var_validated:FAIL:environment variable found but no validation {} block detected. Add a validation block with a condition."
fi

# Task 2: db_password has sensitive = true
HAS_SENSITIVE=0
if [ -f "$VARS" ]; then
  grep -v '^[[:space:]]*#' "$VARS" | grep -qE 'sensitive[[:space:]]*=[[:space:]]*true' && HAS_SENSITIVE=1
fi
if [ "$HAS_SENSITIVE" -eq 1 ]; then
  echo "CHECK:sensitive_var:PASS:sensitive = true found in variables.tf."
else
  echo "CHECK:sensitive_var:FAIL:No sensitive = true found in variables.tf. Add it to the db_password variable."
fi

# Task 3: main.tf uses conditional expression (? :)
MAIN="$LAB/main.tf"
HAS_CONDITIONAL=0
if [ -f "$MAIN" ]; then
  grep -v '^[[:space:]]*#' "$MAIN" | grep -qE '\?[^:]+:' && HAS_CONDITIONAL=1
fi
if [ "$HAS_CONDITIONAL" -eq 1 ]; then
  echo "CHECK:conditional_local:PASS:Conditional expression (? :) found in main.tf."
else
  echo "CHECK:conditional_local:FAIL:No conditional expression found in main.tf. Add one in a locals block, e.g.: is_production = var.environment == \"prod\" ? true : false"
fi

# Task 4: state file with managed resource
STATE="$LAB/terraform.tfstate"
if [ -f "$STATE" ]; then
  MANAGED=$(grep -c '"mode":[[:space:]]*"managed"' "$STATE" 2>/dev/null || echo 0)
  if [ "$MANAGED" -gt 0 ]; then
    echo "CHECK:apply_succeeded:PASS:terraform.tfstate records $MANAGED managed resource(s)."
  else
    echo "CHECK:apply_succeeded:FAIL:terraform.tfstate has no managed resources. Run terraform apply."
  fi
else
  echo "CHECK:apply_succeeded:FAIL:No terraform.tfstate found. Run: terraform init && terraform apply -auto-approve -var='db_password=secret' -var='environment=staging'"
fi
`,
};
