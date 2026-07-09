import type { LabDefinition } from "./types";

export const terraformCount: LabDefinition = {
  id: "terraform-count",
  track: "terraform",
  level: 1,
  title: "Terraform Count: Stamp Out Multiple Resources",
  category: "Infrastructure as Code",
  difficulty: "beginner",
  summary:
    "Use the count meta-argument to create four identical worker-node registry entries without repeating resource blocks.",
  estimatedMinutes: 20,
  order: 10,
  image: "hashicorp/terraform:1.9",
  entrypoint: ["sleep", "infinity"],
  shell: "sh",
  terminals: [{ name: "main", user: "root", cwd: "/root/tf-lab" }],
  objectives: [
    "Declare a node_count input variable with default 4",
    "Use count = var.node_count on a terraform_data resource",
    "Reference count.index to give each instance a unique name",
    "Expose all instances via a splat output",
    "Apply and verify 4 managed resources in state",
  ],
  instructions: `## Scenario

The Nautilus platform team registers every worker node in Terraform state so that drift is detected automatically. They need **4 worker nodes** — \`worker-0\` through \`worker-3\` — all with the same shape. Writing four identical resource blocks would be unmaintainable; instead, use Terraform's \`count\` meta-argument.

The working directory is \`/root/tf-lab\`. Write all \`.tf\` files there.

**Note:** No text editor is installed. Use heredocs:
\`\`\`sh
cat > variables.tf <<'EOF'
# HCL here
EOF
\`\`\`

---

## Tasks

### 1. Create \`variables.tf\`

Define one input variable:

| Name | Type | Default |
|---|---|---|
| \`node_count\` | number | \`4\` |

\`\`\`hcl
variable "node_count" {
  type    = number
  default = 4
}
\`\`\`

### 2. Create \`main.tf\` using \`count\`

Use \`count = var.node_count\` and \`count.index\` so each instance gets a unique label:

\`\`\`hcl
resource "terraform_data" "worker" {
  count = var.node_count
  input = "worker-\${count.index}"
}
\`\`\`

### 3. Create \`outputs.tf\` with a splat expression

Expose all instance values as a list using the \`[*]\` splat operator:

\`\`\`hcl
output "worker_names" {
  value = terraform_data.worker[*].output
}
\`\`\`

### 4. Init and apply

\`\`\`sh
terraform init
terraform validate
terraform apply -auto-approve
terraform output
\`\`\`

You should see:
\`\`\`
worker_names = [
  "worker-0",
  "worker-1",
  "worker-2",
  "worker-3",
]
\`\`\`

## Notes

- \`count.index\` starts at **0** — the first resource is \`worker-0\`.
- The splat expression \`resource[*].output\` collects outputs from all instances into a list.
- To address a single instance use \`terraform_data.worker[2]\` (zero-based index).
- Run \`terraform state list\` to see all four entries in state.`,
  tasks: [
    {
      id: "count_variable",
      description: "variables.tf defines a 'node_count' variable of type number",
    },
    {
      id: "count_resource",
      description: "main.tf uses count = var.node_count on the terraform_data resource",
    },
    {
      id: "splat_output",
      description: "outputs.tf exposes worker instances using a splat expression [*]",
    },
    {
      id: "four_resources_in_state",
      description: "terraform apply succeeded and state records exactly 4 managed resources",
    },
  ],
  hints: [
    "Use `cat > variables.tf <<'EOF'` … `EOF` to create files — there is no nano/vim in this image.",
    "The resource block should have `count = var.node_count` as a top-level argument, not inside a nested block. Then use `\"worker-\\${count.index}\"` as the input string.",
    "For the splat output write: `value = terraform_data.worker[*].output` — the `[*]` collects all instances into a list.",
    "Run `terraform init` first, then `terraform apply -auto-approve`. After apply, check with `terraform state list` — you should see 4 lines like `terraform_data.worker[0]`.",
  ],
  setupScript: `mkdir -p /root/tf-lab`,
  verifyScript: `
LAB=/root/tf-lab

# Task 1: variables.tf defines node_count variable
VARS="$LAB/variables.tf"
if [ -f "$VARS" ] && grep -v '^[[:space:]]*#' "$VARS" | grep -qE 'variable[[:space:]]+"node_count"'; then
  echo "CHECK:count_variable:PASS:node_count variable found in variables.tf."
else
  echo "CHECK:count_variable:FAIL:variables.tf is missing variable \"node_count\". Add: variable \"node_count\" { type = number; default = 4 }"
fi

# Task 2: main.tf uses count = var.node_count
MAIN="$LAB/main.tf"
HAS_COUNT=0
if [ -f "$MAIN" ]; then
  grep -v '^[[:space:]]*#' "$MAIN" | grep -qE 'count[[:space:]]*=' && HAS_COUNT=1
fi
if [ "$HAS_COUNT" -eq 1 ]; then
  echo "CHECK:count_resource:PASS:count meta-argument found in main.tf."
else
  echo "CHECK:count_resource:FAIL:main.tf is missing a count = ... argument. Add count = var.node_count inside the terraform_data resource block."
fi

# Task 3: outputs.tf uses splat [*]
OUT="$LAB/outputs.tf"
if [ -f "$OUT" ] && grep -v '^[[:space:]]*#' "$OUT" | grep -qE '\[\*\]'; then
  echo "CHECK:splat_output:PASS:Splat expression [*] found in outputs.tf."
else
  echo "CHECK:splat_output:FAIL:outputs.tf is missing a splat expression. Use: value = terraform_data.worker[*].output"
fi

# Task 4: state has 4 managed resources
STATE="$LAB/terraform.tfstate"
if [ -f "$STATE" ]; then
  MANAGED=$(grep -c '"mode":[[:space:]]*"managed"' "$STATE" 2>/dev/null || echo 0)
  if [ "$MANAGED" -ge 4 ]; then
    echo "CHECK:four_resources_in_state:PASS:terraform.tfstate records $MANAGED managed resource(s)."
  else
    echo "CHECK:four_resources_in_state:FAIL:Expected 4 managed resources in state, found $MANAGED. Ensure node_count=4 and run terraform apply -auto-approve."
  fi
else
  echo "CHECK:four_resources_in_state:FAIL:No terraform.tfstate found. Run: terraform init && terraform apply -auto-approve"
fi
`,
};
