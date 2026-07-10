import type { LabDefinition } from "./types";

export const terraformL1Locals: LabDefinition = {
  id: "terraform-l1-locals",
  track: "terraform",
  level: 1,
  title: "Lab 06: Local Values",
  category: "Infrastructure as Code",
  difficulty: "beginner",
  summary:
    "Implement reusable naming logic with Terraform local values — compute a standard resource prefix from variables and apply it consistently across resources and outputs.",
  estimatedMinutes: 20,
  order: 25,
  image: "hashicorp/terraform:1.9",
  entrypoint: ["sleep", "infinity"],
  shell: "sh",
  terminals: [{ name: "main", user: "root", cwd: "/root/tf-lab" }],
  objectives: [
    "Define project_name, environment, and region variables",
    "Compute standardised names in a locals {} block",
    "Reference local values inside resource blocks",
    "Expose generated names via outputs",
    "Apply and verify the naming convention is consistent",
  ],
  instructions: `## Scenario

Your organisation follows a standard naming convention for all infrastructure resources: \`<project>-<environment>-<region>-<component>\`. Implement this reusable naming logic using Terraform local values so the convention is defined once and applied everywhere.

Working directory: \`/root/tf-lab\`

**Tip — no text editor installed.** Use heredocs:
\`\`\`sh
cat > variables.tf <<'EOF'
# HCL here
EOF
\`\`\`

---

## Steps

### 1 — Define variables (variables.tf)

\`\`\`hcl
variable "project_name" {
  type    = string
  default = "acme"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "region" {
  type    = string
  default = "us-east-1"
}
\`\`\`

### 2 — Compute names with locals (main.tf)

\`\`\`hcl
terraform {
  required_version = ">= 1.0"
}

locals {
  prefix      = "\${var.project_name}-\${var.environment}"
  bucket_name = "\${local.prefix}-\${var.region}-assets"
  db_name     = "\${local.prefix}-db"
}

resource "terraform_data" "naming" {
  input = {
    prefix = local.prefix
    bucket = local.bucket_name
    db     = local.db_name
  }
}
\`\`\`

Locals can reference other locals (as \`local.prefix\` is used in \`bucket_name\`) — Terraform resolves them in dependency order.

### 3 — Output the generated names (outputs.tf)

\`\`\`hcl
output "prefix" {
  value = local.prefix
}

output "bucket_name" {
  value = local.bucket_name
}

output "db_name" {
  value = local.db_name
}
\`\`\`

### 4 — Apply and verify

\`\`\`sh
terraform init
terraform apply -auto-approve
terraform output
\`\`\`

Try changing the project name at apply time and observe how every generated name updates automatically:

\`\`\`sh
terraform apply -auto-approve -var="project_name=globex" -var="environment=prod"
terraform output
\`\`\``,
  tasks: [
    {
      id: "three_variables",
      description:
        "variables.tf defines project_name, environment, and region variables",
    },
    {
      id: "locals_block",
      description: "main.tf contains a locals {} block with at least two local values",
    },
    {
      id: "locals_in_resource",
      description: "main.tf references at least one local.<name> inside a resource block",
    },
    {
      id: "locals_output",
      description: "outputs.tf exposes at least one local.<name> value",
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
OUTS="$LAB/outputs.tf"

# Task 1: variables.tf has project_name, environment, region
HAS_PROJ=0; HAS_ENV=0; HAS_REG=0
if [ -f "$VARS" ]; then
  grep -v '^[[:space:]]*#' "$VARS" | grep -qE 'variable[[:space:]]+"project_name"' && HAS_PROJ=1
  grep -v '^[[:space:]]*#' "$VARS" | grep -qE 'variable[[:space:]]+"environment"'  && HAS_ENV=1
  grep -v '^[[:space:]]*#' "$VARS" | grep -qE 'variable[[:space:]]+"region"'        && HAS_REG=1
fi
if [ "$HAS_PROJ" -eq 1 ] && [ "$HAS_ENV" -eq 1 ] && [ "$HAS_REG" -eq 1 ]; then
  echo "CHECK:three_variables:PASS:project_name, environment, and region variables found."
else
  MISSING=""
  [ "$HAS_PROJ" -eq 0 ] && MISSING="$MISSING project_name"
  [ "$HAS_ENV"  -eq 0 ] && MISSING="$MISSING environment"
  [ "$HAS_REG"  -eq 0 ] && MISSING="$MISSING region"
  echo "CHECK:three_variables:FAIL:Missing variables:$MISSING. Add them to variables.tf."
fi

# Task 2: locals block with at least 2 values (count assignments inside locals {} only)
HAS_LOCALS=0
LOCAL_COUNT=0
if [ -f "$MAIN" ]; then
  grep -v '^[[:space:]]*#' "$MAIN" | grep -qE '^[[:space:]]*locals[[:space:]]*\{' && HAS_LOCALS=1
  LOCAL_COUNT=$(awk '
    /^[[:space:]]*locals[[:space:]]*\{/ { in_l=1; depth=1; next }
    in_l {
      line=$0; gsub(/#.*/,"",line)
      n=split(line,ch,""); for(i=1;i<=n;i++){if(ch[i]=="{")depth++;if(ch[i]=="}")depth--}
      if(depth<=0){in_l=0;next}
      if(line~/^[[:space:]]*[a-zA-Z_][a-zA-Z_0-9]*[[:space:]]*=/)cnt++
    }
    END{print cnt+0}
  ' "$MAIN" 2>/dev/null || echo 0)
fi
if [ "$HAS_LOCALS" -eq 1 ] && [ "$LOCAL_COUNT" -ge 2 ]; then
  echo "CHECK:locals_block:PASS:locals {} block found with $LOCAL_COUNT computed values."
elif [ "$HAS_LOCALS" -eq 0 ]; then
  echo "CHECK:locals_block:FAIL:No locals {} block in main.tf. Add: locals { prefix = \"\${var.project_name}-\${var.environment}\" }"
else
  echo "CHECK:locals_block:FAIL:locals {} block found but only $LOCAL_COUNT value(s) detected — need at least 2 (e.g. prefix, bucket_name, db_name)."
fi

# Task 3: local.<name> reference inside resource
HAS_LOCAL_IN_RES=0
if [ -f "$MAIN" ]; then
  grep -v '^[[:space:]]*#' "$MAIN" | grep -qE 'local\.[a-zA-Z_]' && HAS_LOCAL_IN_RES=1
fi
if [ "$HAS_LOCAL_IN_RES" -eq 1 ]; then
  echo "CHECK:locals_in_resource:PASS:local.<name> reference found in main.tf."
else
  echo "CHECK:locals_in_resource:FAIL:No local.<name> reference found in main.tf. Use locals inside resource blocks, e.g.: input = local.prefix"
fi

# Task 4: outputs.tf references a local value
HAS_LOCAL_OUT=0
if [ -f "$OUTS" ]; then
  grep -v '^[[:space:]]*#' "$OUTS" | grep -qE 'local\.[a-zA-Z_]' && HAS_LOCAL_OUT=1
fi
if [ "$HAS_LOCAL_OUT" -eq 1 ]; then
  echo "CHECK:locals_output:PASS:outputs.tf exposes a local value."
else
  echo "CHECK:locals_output:FAIL:outputs.tf does not reference any local.<name>. Add an output whose value is a local, e.g.: value = local.prefix"
fi

# Task 5: state has managed resources
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
