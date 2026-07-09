import type { LabDefinition } from "./types";

export const terraformBasics: LabDefinition = {
  id: "terraform-basics",
  track: "terraform",
  level: 1,
  title: "Terraform Basics: Write, Plan, Apply",
  category: "Infrastructure as Code",
  difficulty: "intermediate",
  summary:
    "Write a Terraform project from scratch — define variables, locals, and a managed resource, then init, validate, plan, and apply it.",
  estimatedMinutes: 20,
  order: 7,
  // hashicorp/terraform sets ENTRYPOINT ["/bin/terraform"] so we must override it to /bin/sh
  // so that Cmd ["sleep", "infinity"] keeps the container alive instead of running terraform directly.
  image: "hashicorp/terraform:1.9",
  entrypoint: ["/bin/sh"],
  shell: "sh",
  terminals: [{ name: "main", user: "root", cwd: "/root/tf-lab" }],
  objectives: [
    "Define input variables in variables.tf (environment and project_name)",
    "Write main.tf with a locals block and a terraform_data resource",
    "Expose a computed value in outputs.tf",
    "Run terraform init → validate → apply and confirm the state file is created",
  ],
  instructions: `## Scenario

Your team is adopting Infrastructure as Code. Your first task: create a Terraform project that models your staging environment's configuration — define input variables, compute a resource tag with \`locals\`, manage a resource, and expose an output so CI pipelines can read it.

The working directory is already created at \`/root/tf-lab\`. Write your \`.tf\` files there and run Terraform commands from the same directory.

**Tip**: there is no text editor installed. Use heredocs to create files:

\`\`\`sh
cat > variables.tf <<'EOF'
# your HCL here
EOF
\`\`\`

---

## Steps

### 1 — variables.tf

Define two input variables:

| Name | Type | Default |
|---|---|---|
| \`environment\` | string | \`"staging"\` |
| \`project_name\` | string | *(required — no default)* |

\`\`\`hcl
variable "environment" {
  type    = string
  default = "staging"
}

variable "project_name" {
  type = string
}
\`\`\`

### 2 — main.tf

Add a \`locals\` block that computes a tag string from the two variables, then declare a \`terraform_data\` resource (built into Terraform — no provider download needed) that stores the tag as its \`input\`:

\`\`\`hcl
locals {
  tag = "\${var.project_name}-\${var.environment}"
}

resource "terraform_data" "config" {
  input = local.tag
}
\`\`\`

### 3 — outputs.tf

Expose the resource's computed output value so it can be read by pipelines:

\`\`\`hcl
output "resource_tag" {
  value = terraform_data.config.output
}
\`\`\`

### 4 — Run Terraform

\`\`\`sh
terraform init
terraform validate
terraform plan -var="project_name=myapp"
terraform apply -auto-approve -var="project_name=myapp"
\`\`\`

After a successful apply, \`terraform output\` should print your tag. Check the state with \`cat terraform.tfstate\`.`,
  tasks: [
    {
      id: "variables_defined",
      description: "variables.tf defines both 'environment' and 'project_name' variables",
    },
    {
      id: "resource_and_locals",
      description: "main.tf has a locals block and a terraform_data resource",
    },
    {
      id: "output_defined",
      description: "outputs.tf defines at least one output value",
    },
    {
      id: "apply_succeeded",
      description: "terraform apply has been run and the state file records at least one resource",
    },
  ],
  setupScript: `
mkdir -p /root/tf-lab
`,
  verifyScript: `
LAB=/root/tf-lab

# Task 1: variables.tf defines both required variables
# Use grep -v to skip comment lines before checking, then match the block keyword
VARS_FILE="$LAB/variables.tf"
HAS_ENV=0
HAS_PROJ=0
if [ -f "$VARS_FILE" ]; then
  grep -v '^[[:space:]]*#' "$VARS_FILE" | grep -qE 'variable[[:space:]]+"environment"' && HAS_ENV=1
  grep -v '^[[:space:]]*#' "$VARS_FILE" | grep -qE 'variable[[:space:]]+"project_name"' && HAS_PROJ=1
fi
if [ "$HAS_ENV" -eq 1 ] && [ "$HAS_PROJ" -eq 1 ]; then
  echo "CHECK:variables_defined:PASS:Both 'environment' and 'project_name' variables are defined in variables.tf."
elif [ "$HAS_ENV" -eq 0 ] && [ "$HAS_PROJ" -eq 0 ]; then
  echo "CHECK:variables_defined:FAIL:variables.tf not found or missing both variables. Create variables.tf with variable \"environment\" and variable \"project_name\" blocks."
elif [ "$HAS_ENV" -eq 0 ]; then
  echo "CHECK:variables_defined:FAIL:variables.tf is missing variable \"environment\". Add: variable \"environment\" { type = string; default = \"staging\" }"
else
  echo "CHECK:variables_defined:FAIL:variables.tf is missing variable \"project_name\". Add: variable \"project_name\" { type = string }"
fi

# Task 2: main.tf has a locals block and a terraform_data resource (not commented out)
MAIN_FILE="$LAB/main.tf"
HAS_LOCALS=0
HAS_RESOURCE=0
if [ -f "$MAIN_FILE" ]; then
  grep -v '^[[:space:]]*#' "$MAIN_FILE" | grep -qE '^[[:space:]]*locals[[:space:]]*\{' && HAS_LOCALS=1
  grep -v '^[[:space:]]*#' "$MAIN_FILE" | grep -qE 'resource[[:space:]]+"terraform_data"' && HAS_RESOURCE=1
fi
if [ "$HAS_LOCALS" -eq 1 ] && [ "$HAS_RESOURCE" -eq 1 ]; then
  echo "CHECK:resource_and_locals:PASS:main.tf contains a locals block and a terraform_data resource."
elif [ "$HAS_LOCALS" -eq 0 ]; then
  echo "CHECK:resource_and_locals:FAIL:main.tf is missing a locals block. Add: locals { tag = \"\${var.project_name}-\${var.environment}\" }"
else
  echo "CHECK:resource_and_locals:FAIL:main.tf is missing a terraform_data resource. Add: resource \"terraform_data\" \"config\" { input = local.tag }"
fi

# Task 3: outputs.tf defines at least one output (allow any indentation level)
OUT_FILE="$LAB/outputs.tf"
if [ -f "$OUT_FILE" ] && grep -v '^[[:space:]]*#' "$OUT_FILE" | grep -qE '[[:space:]]*output[[:space:]]+"'; then
  echo "CHECK:output_defined:PASS:outputs.tf defines at least one output."
else
  echo "CHECK:output_defined:FAIL:No output block found in outputs.tf. Add: output \"resource_tag\" { value = terraform_data.config.output }"
fi

# Task 4: terraform apply has run and the state file records at least one managed resource
STATEFILE="$LAB/terraform.tfstate"
if [ -f "$STATEFILE" ]; then
  # Count "mode": "managed" entries — each is one fully applied resource
  MANAGED=$(grep -c '"mode":[[:space:]]*"managed"' "$STATEFILE" 2>/dev/null || echo 0)
  if [ "$MANAGED" -gt 0 ]; then
    echo "CHECK:apply_succeeded:PASS:terraform.tfstate records $MANAGED managed resource(s) — apply succeeded."
  else
    echo "CHECK:apply_succeeded:FAIL:terraform.tfstate exists but has no managed resources. Run: terraform apply -auto-approve -var='project_name=myapp'"
  fi
else
  echo "CHECK:apply_succeeded:FAIL:No terraform.tfstate found. Run: terraform init && terraform apply -auto-approve -var='project_name=myapp'"
fi
`,
};
