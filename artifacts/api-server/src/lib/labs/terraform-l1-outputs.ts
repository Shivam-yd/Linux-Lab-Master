import type { LabDefinition } from "./types";

export const terraformL1Outputs: LabDefinition = {
  id: "terraform-l1-outputs",
  track: "terraform",
  level: 1,
  title: "Lab 05: Outputs",
  category: "Infrastructure as Code",
  difficulty: "beginner",
  summary:
    "Configure Terraform output values so CI/CD pipelines can retrieve deployment details — including a sensitive output — and display them with the CLI.",
  estimatedMinutes: 20,
  order: 24,
  image: "hashicorp/terraform:1.9",
  entrypoint: ["sleep", "infinity"],
  shell: "sh",
  terminals: [{ name: "main", user: "root", cwd: "/root/tf-lab" }],
  objectives: [
    "Define at least two output values in outputs.tf",
    "Reference a resource attribute in at least one output",
    "Mark one output as sensitive = true",
    "Apply and verify outputs appear with terraform output",
    "Display a specific output by name using the CLI",
  ],
  instructions: `## Scenario

Your CI/CD pipeline needs information after deployment — the application name, the deployed version, and a database URL. Configure Terraform outputs so downstream jobs can retrieve these values, and mark the database URL as sensitive to prevent it appearing in plain text logs.

Working directory: \`/root/tf-lab\`

**Tip — no text editor installed.** Use heredocs:
\`\`\`sh
cat > outputs.tf <<'EOF'
# HCL here
EOF
\`\`\`

---

## Steps

### 1 — Create the resource (main.tf)

\`\`\`hcl
terraform {
  required_version = ">= 1.0"
}

resource "terraform_data" "app" {
  input = {
    name    = "myapp"
    version = "2.1.0"
  }
}
\`\`\`

### 2 — Define outputs (outputs.tf)

Output blocks expose values after apply. Use \`terraform_data.<name>.output\` to reference the stored value:

\`\`\`hcl
output "app_name" {
  description = "The name of the deployed application"
  value       = terraform_data.app.output.name
}

output "app_version" {
  description = "The version that was deployed"
  value       = terraform_data.app.output.version
}

output "db_url" {
  description = "Database connection string (sensitive)"
  value       = "postgres://app:password@db.internal/prod"
  sensitive   = true
}
\`\`\`

### 3 — Apply and inspect outputs

\`\`\`sh
terraform init
terraform apply -auto-approve
\`\`\`

List all outputs:
\`\`\`sh
terraform output
\`\`\`

Read a specific output by name:
\`\`\`sh
terraform output app_name
terraform output app_version
\`\`\`

Sensitive outputs are redacted in the terminal. To read the raw value (e.g. in scripts):
\`\`\`sh
terraform output -raw db_url
terraform output -json | jq .db_url.value
\`\`\``,
  tasks: [
    {
      id: "multiple_outputs",
      description: "outputs.tf defines at least two output blocks",
    },
    {
      id: "resource_attribute_referenced",
      description: "At least one output references a resource attribute (terraform_data.*.output)",
    },
    {
      id: "sensitive_output",
      description: "At least one output block has sensitive = true",
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
OUTS="$LAB/outputs.tf"

# Task 1: at least 2 output blocks
OUT_COUNT=0
if [ -f "$OUTS" ]; then
  OUT_COUNT=$(grep -v '^[[:space:]]*#' "$OUTS" | grep -cE '^[[:space:]]*output[[:space:]]+"' 2>/dev/null || echo 0)
fi
if [ "$OUT_COUNT" -ge 2 ]; then
  echo "CHECK:multiple_outputs:PASS:Found $OUT_COUNT output block(s) in outputs.tf."
else
  echo "CHECK:multiple_outputs:FAIL:Only $OUT_COUNT output(s) defined. Add at least 2 output blocks to outputs.tf."
fi

# Task 2: at least one output references a resource attribute (terraform_data.*.output)
HAS_ATTR_REF=0
if [ -f "$OUTS" ]; then
  grep -v '^[[:space:]]*#' "$OUTS" | grep -qE 'terraform_data\.[a-zA-Z_]+\.output' && HAS_ATTR_REF=1
fi
if [ "$HAS_ATTR_REF" -eq 1 ]; then
  echo "CHECK:resource_attribute_referenced:PASS:An output references a terraform_data resource attribute."
else
  echo "CHECK:resource_attribute_referenced:FAIL:No output references a resource attribute. At least one output value should be terraform_data.<name>.output or terraform_data.<name>.output.<field>."
fi

# Task 3: at least one output has sensitive = true
HAS_SENSITIVE=0
if [ -f "$OUTS" ]; then
  grep -v '^[[:space:]]*#' "$OUTS" | grep -qE 'sensitive[[:space:]]*=[[:space:]]*true' && HAS_SENSITIVE=1
fi
if [ "$HAS_SENSITIVE" -eq 1 ]; then
  echo "CHECK:sensitive_output:PASS:sensitive = true found in outputs.tf."
else
  echo "CHECK:sensitive_output:FAIL:No sensitive = true found. Mark at least one output as sensitive, e.g.: sensitive = true"
fi

# Task 4: state has managed resources
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
