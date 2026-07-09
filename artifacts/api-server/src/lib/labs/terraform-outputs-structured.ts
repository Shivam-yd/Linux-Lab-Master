import type { LabDefinition } from "./types";

export const terraformOutputsStructured: LabDefinition = {
  id: "terraform-outputs-structured",
  track: "terraform",
  level: 1,
  title: "Terraform Outputs: Sensitive, Structured & JSON",
  category: "Infrastructure as Code",
  difficulty: "beginner",
  summary:
    "Define sensitive, map, and plain string outputs — then query them programmatically with terraform output -json so CI pipelines can consume them.",
  estimatedMinutes: 20,
  order: 14,
  image: "hashicorp/terraform:1.9",
  entrypoint: ["sleep", "infinity"],
  shell: "sh",
  terminals: [{ name: "main", user: "root", cwd: "/root/tf-lab" }],
  objectives: [
    "Define a sensitive output (db_password) that Terraform redacts in logs",
    "Define a map/object output (app_config) with multiple fields",
    "Apply and run terraform output -json to inspect values programmatically",
    "Use terraform output <name> to retrieve a single output value",
  ],
  instructions: `## Scenario

The Nautilus CI/CD pipeline needs to read Terraform outputs after every apply: the app's database password (sensitive), the app config map, and the deployed environment name. You'll structure \`outputs.tf\` correctly and verify that \`terraform output -json\` emits machine-readable JSON.

Working directory: \`/root/tf-lab\`

**Note:** Use heredocs to create files (no editor installed):
\`\`\`sh
cat > main.tf <<'EOF'
# HCL here
EOF
\`\`\`

---

## Tasks

### 1. Create \`variables.tf\`

| Name | Type | Default |
|---|---|---|
| \`environment\` | string | \`"staging"\` |
| \`db_password\` | string | \`"Naut!lus-DB-2024"\` |

\`\`\`hcl
variable "environment" {
  type    = string
  default = "staging"
}

variable "db_password" {
  type      = string
  sensitive = true
  default   = "Naut!lus-DB-2024"
}
\`\`\`

### 2. Create \`main.tf\`

Store a config record using the variables:

\`\`\`hcl
resource "terraform_data" "app" {
  input = {
    env      = var.environment
    password = var.db_password
  }
}
\`\`\`

### 3. Create \`outputs.tf\` with three outputs

\`\`\`hcl
output "environment" {
  value = var.environment
}

output "db_password" {
  value     = var.db_password
  sensitive = true
}

output "app_config" {
  value = {
    environment = var.environment
    resource_id = "nautilus-app-\${var.environment}"
    port        = 8443
  }
}
\`\`\`

### 4. Apply and inspect outputs

\`\`\`sh
terraform init
terraform apply -auto-approve

# List all outputs (password is redacted)
terraform output

# Get the full JSON (sensitive values are included in JSON)
terraform output -json

# Get a single value
terraform output environment
terraform output app_config
\`\`\`

## Notes

- \`sensitive = true\` on an output **redacts** the value in \`terraform output\` and plan logs. The value is still stored in state and visible via \`terraform output -json\`.
- The default password for \`db_password\` is \`Naut!lus-DB-2024\` — no flags needed unless you want to override.
- \`terraform output -json\` is how CI systems (GitHub Actions, Jenkins) read outputs — pipe it to \`jq\` for parsing.
- Map outputs are HCL object literals \`{ key = value }\` — they become JSON objects in \`-json\` mode.`,
  tasks: [
    {
      id: "sensitive_output",
      description: "outputs.tf defines a 'db_password' output with sensitive = true",
    },
    {
      id: "map_output",
      description: "outputs.tf defines 'app_config' as an object/map output with multiple fields",
    },
    {
      id: "sensitive_variable",
      description: "variables.tf marks 'db_password' as sensitive = true",
    },
    {
      id: "apply_succeeded",
      description: "terraform apply succeeded and state records at least 1 managed resource",
    },
  ],
  hints: [
    "Create variables.tf first with `environment` (string, default \"staging\") and `db_password` (string, sensitive=true, default \"Naut!lus-DB-2024\"). Both variables need their own block.",
    "In main.tf the `terraform_data` resource input can be an object: `input = { env = var.environment, password = var.db_password }`. Curly braces make it an HCL object.",
    "In outputs.tf: the sensitive output needs `sensitive = true` at the same level as `value`. The app_config output's `value` is a plain HCL object literal `{ environment = ..., resource_id = ..., port = 8443 }`.",
    "After apply, run `terraform output` (you'll see `db_password = <sensitive>`). Run `terraform output -json` to see all values including the sensitive one in JSON form.",
  ],
  setupScript: `mkdir -p /root/tf-lab`,
  verifyScript: `
LAB=/root/tf-lab

# Task 1: outputs.tf has sensitive output
OUT="$LAB/outputs.tf"
HAS_SENSITIVE_OUT=0
if [ -f "$OUT" ]; then
  grep -v '^[[:space:]]*#' "$OUT" | grep -qE 'sensitive[[:space:]]*=[[:space:]]*true' && HAS_SENSITIVE_OUT=1
fi
if [ "$HAS_SENSITIVE_OUT" -eq 1 ]; then
  echo "CHECK:sensitive_output:PASS:sensitive = true found in outputs.tf."
else
  echo "CHECK:sensitive_output:FAIL:outputs.tf is missing sensitive = true on the db_password output. Add: sensitive = true inside the output \"db_password\" block."
fi

# Task 2: outputs.tf has an object/map output (detected by { inside value)
HAS_MAP_OUT=0
if [ -f "$OUT" ]; then
  grep -v '^[[:space:]]*#' "$OUT" | grep -qE 'app_config' && HAS_MAP_OUT=1
fi
if [ "$HAS_MAP_OUT" -eq 1 ]; then
  echo "CHECK:map_output:PASS:app_config output found in outputs.tf."
else
  echo "CHECK:map_output:FAIL:outputs.tf is missing an 'app_config' map output. Add: output \"app_config\" { value = { environment = var.environment, resource_id = \"...\", port = 8443 } }"
fi

# Task 3: variables.tf has sensitive db_password
VARS="$LAB/variables.tf"
HAS_SENSITIVE_VAR=0
if [ -f "$VARS" ]; then
  grep -v '^[[:space:]]*#' "$VARS" | grep -qE 'sensitive[[:space:]]*=[[:space:]]*true' && HAS_SENSITIVE_VAR=1
fi
if [ "$HAS_SENSITIVE_VAR" -eq 1 ]; then
  echo "CHECK:sensitive_variable:PASS:sensitive = true found in variables.tf."
else
  echo "CHECK:sensitive_variable:FAIL:variables.tf is missing sensitive = true on db_password. Add it inside the variable \"db_password\" block."
fi

# Task 4: state has managed resource
STATE="$LAB/terraform.tfstate"
if [ -f "$STATE" ]; then
  MANAGED=$(grep -c '"mode":[[:space:]]*"managed"' "$STATE" 2>/dev/null || echo 0)
  if [ "$MANAGED" -ge 1 ]; then
    echo "CHECK:apply_succeeded:PASS:terraform.tfstate records $MANAGED managed resource(s)."
  else
    echo "CHECK:apply_succeeded:FAIL:terraform.tfstate has no managed resources. Run: terraform apply -auto-approve"
  fi
else
  echo "CHECK:apply_succeeded:FAIL:No terraform.tfstate found. Run: terraform init && terraform apply -auto-approve"
fi
`,
};
