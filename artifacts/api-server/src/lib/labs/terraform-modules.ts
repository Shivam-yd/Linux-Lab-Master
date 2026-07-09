import type { LabDefinition } from "./types";

export const terraformModules: LabDefinition = {
  id: "terraform-modules",
  track: "terraform",
  level: 3,
  title: "Terraform Modules: Build & Reuse Infrastructure Blocks",
  category: "Infrastructure as Code",
  difficulty: "advanced",
  summary:
    "Write a reusable child module, call it twice from the root config with different inputs, and wire up module outputs — the foundation of production-grade Terraform codebases.",
  estimatedMinutes: 35,
  order: 9,
  image: "hashicorp/terraform:1.9",
  entrypoint: ["sleep", "infinity"],
  shell: "sh",
  terminals: [{ name: "main", user: "root", cwd: "/root/tf-lab" }],
  objectives: [
    "Create a reusable child module under modules/service/",
    "Call the module twice from root main.tf with different inputs",
    "Expose module outputs in root outputs.tf",
    "Apply and verify both module instances appear in state",
  ],
  instructions: `## Scenario

Your platform team wants every service registered in a central config registry. Instead of copy-pasting the same \`terraform_data\` block for every service, you'll write a reusable **module** that encapsulates the pattern, then call it once per service.

Working directory: \`/root/tf-lab\`

**Tip**: use heredocs to write files:
\`\`\`sh
cat > somefile.tf <<'EOF'
# HCL here
EOF
\`\`\`

---

## Directory layout you need to create

\`\`\`
/root/tf-lab/
  main.tf           ← root config, calls the module twice
  outputs.tf        ← root outputs exposing module results
  modules/
    service/
      main.tf       ← module: defines the terraform_data resource
      variables.tf  ← module: declares name and environment inputs
      outputs.tf    ← module: exposes the computed label output
\`\`\`

---

## Steps

### 1 — Write the child module

**modules/service/variables.tf**
\`\`\`hcl
variable "name" {
  type = string
}

variable "environment" {
  type    = string
  default = "dev"
}
\`\`\`

**modules/service/main.tf**
\`\`\`hcl
resource "terraform_data" "service" {
  input = "\${var.name}-\${var.environment}"
}
\`\`\`

**modules/service/outputs.tf**
\`\`\`hcl
output "label" {
  value = terraform_data.service.output
}
\`\`\`

### 2 — Root main.tf: call the module twice

\`\`\`hcl
module "api" {
  source      = "./modules/service"
  name        = "api"
  environment = "prod"
}

module "worker" {
  source      = "./modules/service"
  name        = "worker"
  environment = "staging"
}
\`\`\`

### 3 — Root outputs.tf

\`\`\`hcl
output "api_label" {
  value = module.api.label
}

output "worker_label" {
  value = module.worker.label
}
\`\`\`

### 4 — Init and apply

\`\`\`sh
mkdir -p modules/service
# write the files above, then:
terraform init
terraform validate
terraform apply -auto-approve
terraform output
\`\`\`

You should see:
\`\`\`
api_label    = "api-prod"
worker_label = "worker-staging"
\`\`\``,
  tasks: [
    {
      id: "module_source_exists",
      description:
        "modules/service/ directory contains main.tf, variables.tf, and outputs.tf",
    },
    {
      id: "root_calls_module_twice",
      description:
        "Root main.tf calls the ./modules/service module at least twice with different names",
    },
    {
      id: "root_exposes_outputs",
      description: "Root outputs.tf references at least one module output",
    },
    {
      id: "apply_two_resources",
      description:
        "terraform apply succeeded and state records at least two managed resources",
    },
  ],
  setupScript: `
mkdir -p /root/tf-lab/modules/service
`,
  verifyScript: `
LAB=/root/tf-lab
MOD="$LAB/modules/service"

# Task 1: module directory has the three required files
HAS_MAIN=0; HAS_VARS=0; HAS_OUT=0
[ -f "$MOD/main.tf" ]      && HAS_MAIN=1
[ -f "$MOD/variables.tf" ] && HAS_VARS=1
[ -f "$MOD/outputs.tf" ]   && HAS_OUT=1
if [ "$HAS_MAIN" -eq 1 ] && [ "$HAS_VARS" -eq 1 ] && [ "$HAS_OUT" -eq 1 ]; then
  echo "CHECK:module_source_exists:PASS:modules/service/ has main.tf, variables.tf, and outputs.tf."
else
  MISSING=""
  [ "$HAS_MAIN" -eq 0 ] && MISSING="$MISSING main.tf"
  [ "$HAS_VARS" -eq 0 ] && MISSING="$MISSING variables.tf"
  [ "$HAS_OUT" -eq 0 ]  && MISSING="$MISSING outputs.tf"
  echo "CHECK:module_source_exists:FAIL:modules/service/ is missing:$MISSING. Create those files."
fi

# Task 2: root main.tf references the module at least twice
ROOT_MAIN="$LAB/main.tf"
MODULE_CALLS=0
if [ -f "$ROOT_MAIN" ]; then
  MODULE_CALLS=$(grep -v '^[[:space:]]*#' "$ROOT_MAIN" | grep -cE 'module[[:space:]]+"[^"]+"\s*\{' || true)
fi
if [ "$MODULE_CALLS" -ge 2 ]; then
  echo "CHECK:root_calls_module_twice:PASS:Root main.tf contains $MODULE_CALLS module call(s)."
else
  echo "CHECK:root_calls_module_twice:FAIL:Root main.tf has $MODULE_CALLS module block(s); need at least 2. Add two module \"...\" { source = \"./modules/service\" ... } blocks."
fi

# Task 3: root outputs.tf references a module output
ROOT_OUT="$LAB/outputs.tf"
HAS_MOD_OUT=0
if [ -f "$ROOT_OUT" ]; then
  grep -v '^[[:space:]]*#' "$ROOT_OUT" | grep -qE 'module\.' && HAS_MOD_OUT=1
fi
if [ "$HAS_MOD_OUT" -eq 1 ]; then
  echo "CHECK:root_exposes_outputs:PASS:outputs.tf references at least one module output."
else
  echo "CHECK:root_exposes_outputs:FAIL:outputs.tf does not reference any module output. Add: output \"api_label\" { value = module.api.label }"
fi

# Task 4: state has at least two managed resources
STATE="$LAB/terraform.tfstate"
if [ -f "$STATE" ]; then
  MANAGED=$(grep -c '"mode":[[:space:]]*"managed"' "$STATE" 2>/dev/null || echo 0)
  if [ "$MANAGED" -ge 2 ]; then
    echo "CHECK:apply_two_resources:PASS:terraform.tfstate records $MANAGED managed resource(s) — both module instances applied."
  elif [ "$MANAGED" -eq 1 ]; then
    echo "CHECK:apply_two_resources:FAIL:Only 1 managed resource in state; expected at least 2 (one per module call). Check your root main.tf has two module blocks."
  else
    echo "CHECK:apply_two_resources:FAIL:terraform.tfstate has no managed resources. Run: terraform apply -auto-approve"
  fi
else
  echo "CHECK:apply_two_resources:FAIL:No terraform.tfstate found. Run: terraform init && terraform apply -auto-approve"
fi
`,
};
