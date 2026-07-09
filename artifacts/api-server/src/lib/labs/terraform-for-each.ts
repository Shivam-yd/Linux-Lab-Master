import type { LabDefinition } from "./types";

export const terraformForEach: LabDefinition = {
  id: "terraform-for-each",
  track: "terraform",
  level: 1,
  title: "Terraform for_each: Map-Keyed Resources",
  category: "Infrastructure as Code",
  difficulty: "beginner",
  summary:
    "Use for_each over a map variable to create one config record per microservice — api, worker, and scheduler — each with its own port.",
  estimatedMinutes: 20,
  order: 11,
  image: "hashicorp/terraform:1.9",
  entrypoint: ["sleep", "infinity"],
  shell: "sh",
  terminals: [{ name: "main", user: "root", cwd: "/root/tf-lab" }],
  objectives: [
    "Define a map(number) variable mapping service names to ports",
    "Use for_each = var.services on a terraform_data resource",
    "Reference each.key and each.value inside the resource",
    "Expose per-service outputs using a for expression",
    "Apply and verify 3 managed resources in state",
  ],
  instructions: `## Scenario

The Nautilus DevOps team manages three microservices — \`api\` (port \`8080\`), \`worker\` (port \`9090\`), and \`scheduler\` (port \`7070\`) — in a central config registry. Rather than one resource block per service, use Terraform's \`for_each\` to iterate over a map variable so adding a fourth service only requires updating the map.

Working directory: \`/root/tf-lab\`

**Note:** Use heredocs to create files (no editor installed):
\`\`\`sh
cat > variables.tf <<'EOF'
# HCL here
EOF
\`\`\`

---

## Tasks

### 1. Create \`variables.tf\`

Define a \`map(number)\` variable with the three services and their ports:

\`\`\`hcl
variable "services" {
  type = map(number)
  default = {
    api       = 8080
    worker    = 9090
    scheduler = 7070
  }
}
\`\`\`

### 2. Create \`main.tf\` using \`for_each\`

Iterate over the map — \`each.key\` is the service name, \`each.value\` is the port:

\`\`\`hcl
resource "terraform_data" "service" {
  for_each = var.services
  input = {
    name = each.key
    port = each.value
  }
}
\`\`\`

### 3. Create \`outputs.tf\` with a \`for\` expression

Build a map of service → port from the resource instances:

\`\`\`hcl
output "service_ports" {
  value = {
    for k, v in terraform_data.service : k => v.output.port
  }
}
\`\`\`

### 4. Init and apply

\`\`\`sh
terraform init
terraform validate
terraform apply -auto-approve
terraform output
\`\`\`

Expected output:
\`\`\`
service_ports = {
  "api"       = 8080
  "scheduler" = 7070
  "worker"    = 9090
}
\`\`\`

## Notes

- \`for_each\` keys become the **instance address** — e.g. \`terraform_data.service["api"]\`.
- Unlike \`count\`, \`for_each\` instances are addressed by **key**, not index, so removing one entry doesn't renumber the rest.
- Run \`terraform state list\` to see all three entries.
- The \`for\` expression in outputs has the form: \`{ for k, v in resource : k => v.attr }\`.`,
  tasks: [
    {
      id: "map_variable",
      description: "variables.tf defines a 'services' variable of type map(number)",
    },
    {
      id: "for_each_resource",
      description: "main.tf uses for_each = var.services on the terraform_data resource",
    },
    {
      id: "for_expression_output",
      description: "outputs.tf uses a for expression to build a map from service instances",
    },
    {
      id: "three_resources_in_state",
      description: "terraform apply succeeded and state records exactly 3 managed resources",
    },
  ],
  hints: [
    "Create variables.tf first with the `services` map(number) variable. Default should include api=8080, worker=9090, scheduler=7070.",
    "In main.tf, set `for_each = var.services` directly on the resource block. Then `each.key` is the service name string and `each.value` is the port number.",
    "The for expression in outputs.tf looks like: `{ for k, v in terraform_data.service : k => v.output.port }`. Note that `v.output` is the whole input object you set, so `.port` accesses the port field.",
    "After `terraform apply -auto-approve`, run `terraform state list` — you should see `terraform_data.service[\"api\"]`, `terraform_data.service[\"worker\"]`, and `terraform_data.service[\"scheduler\"]`.",
  ],
  setupScript: `mkdir -p /root/tf-lab`,
  verifyScript: `
LAB=/root/tf-lab

# Task 1: variables.tf has a 'services' variable
VARS="$LAB/variables.tf"
if [ -f "$VARS" ] && grep -v '^[[:space:]]*#' "$VARS" | grep -qE 'variable[[:space:]]+"services"'; then
  echo "CHECK:map_variable:PASS:services variable found in variables.tf."
else
  echo "CHECK:map_variable:FAIL:variables.tf is missing variable \"services\". Define it as map(number) with default { api=8080, worker=9090, scheduler=7070 }."
fi

# Task 2: main.tf uses for_each
MAIN="$LAB/main.tf"
if [ -f "$MAIN" ] && grep -v '^[[:space:]]*#' "$MAIN" | grep -qE 'for_each[[:space:]]*='; then
  echo "CHECK:for_each_resource:PASS:for_each found in main.tf."
else
  echo "CHECK:for_each_resource:FAIL:main.tf is missing for_each. Add for_each = var.services to the terraform_data resource block."
fi

# Task 3: outputs.tf has a for expression
OUT="$LAB/outputs.tf"
if [ -f "$OUT" ] && grep -v '^[[:space:]]*#' "$OUT" | grep -qE 'for[[:space:]]+[a-z_]+.*in[[:space:]]+'; then
  echo "CHECK:for_expression_output:PASS:for expression found in outputs.tf."
else
  echo "CHECK:for_expression_output:FAIL:outputs.tf is missing a for expression. Add: output \"service_ports\" { value = { for k, v in terraform_data.service : k => v.output.port } }"
fi

# Task 4: state has 3 managed resources
STATE="$LAB/terraform.tfstate"
if [ -f "$STATE" ]; then
  MANAGED=$(grep -c '"mode":[[:space:]]*"managed"' "$STATE" 2>/dev/null || echo 0)
  if [ "$MANAGED" -ge 3 ]; then
    echo "CHECK:three_resources_in_state:PASS:terraform.tfstate records $MANAGED managed resource(s)."
  else
    echo "CHECK:three_resources_in_state:FAIL:Expected 3 managed resources, found $MANAGED. Check your services map has 3 entries and run terraform apply -auto-approve."
  fi
else
  echo "CHECK:three_resources_in_state:FAIL:No terraform.tfstate found. Run: terraform init && terraform apply -auto-approve"
fi
`,
};
