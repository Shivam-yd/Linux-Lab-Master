import type { LabDefinition } from "./types";

export const terraformLifecycle: LabDefinition = {
  id: "terraform-lifecycle",
  track: "terraform",
  level: 1,
  title: "Terraform Lifecycle Rules: Protect and Replace Safely",
  category: "Infrastructure as Code",
  difficulty: "beginner",
  summary:
    "Use lifecycle meta-arguments to protect a critical resource from accidental deletion and ensure a replacement is created before the old one is destroyed.",
  estimatedMinutes: 20,
  order: 12,
  image: "hashicorp/terraform:1.9",
  entrypoint: ["sleep", "infinity"],
  shell: "sh",
  terminals: [{ name: "main", user: "root", cwd: "/root/tf-lab" }],
  objectives: [
    "Add prevent_destroy = true to a critical 'db_primary' resource",
    "Add create_before_destroy = true to a 'cert' resource",
    "Add ignore_changes to make a resource ignore input drift",
    "Apply and verify 3 managed resources in state",
  ],
  instructions: `## Scenario

The Nautilus infrastructure team has three resources with different safety requirements:

- **\`db_primary\`** — the primary database config record. It must **never** be accidentally destroyed. Add \`prevent_destroy = true\`.
- **\`cert\`** — a TLS certificate record. When it needs replacing, the **new one must exist before the old is removed** to avoid downtime. Add \`create_before_destroy = true\`.
- **\`cache\`** — a cache config whose \`input\` may drift in production but should never be force-updated by Terraform. Add \`ignore_changes = [input]\`.

Working directory: \`/root/tf-lab\`

**Note:** Use heredocs to create files (no editor installed):
\`\`\`sh
cat > main.tf <<'EOF'
# HCL here
EOF
\`\`\`

---

## Tasks

### 1. Create \`main.tf\` with all three resources

\`\`\`hcl
resource "terraform_data" "db_primary" {
  input = "primary-db-config-v1"

  lifecycle {
    prevent_destroy = true
  }
}

resource "terraform_data" "cert" {
  input = "tls-cert-2024"

  lifecycle {
    create_before_destroy = true
  }
}

resource "terraform_data" "cache" {
  input = "redis-cache-config"

  lifecycle {
    ignore_changes = [input]
  }
}
\`\`\`

### 2. Create \`outputs.tf\`

\`\`\`hcl
output "db_label" {
  value = terraform_data.db_primary.output
}

output "cert_label" {
  value = terraform_data.cert.output
}
\`\`\`

### 3. Init and apply

\`\`\`sh
terraform init
terraform validate
terraform apply -auto-approve
\`\`\`

### 4. Verify \`prevent_destroy\` blocks destruction

Try destroying the protected resource — Terraform should **refuse**:

\`\`\`sh
terraform destroy -target=terraform_data.db_primary -auto-approve
# Expected: Error: Instance cannot be destroyed
\`\`\`

## Notes

- \`prevent_destroy = true\` causes Terraform to **error** at plan time if any operation would destroy the resource. It does **not** lock state; it only prevents \`terraform destroy\` or replacement applies from succeeding.
- \`create_before_destroy = true\` reverses the default destroy-then-create order so zero-downtime replacement is possible.
- \`ignore_changes\` accepts a list of attribute names. Use \`all\` to ignore every attribute.
- These lifecycle rules live **inside** the resource block, not in a separate file.`,
  tasks: [
    {
      id: "prevent_destroy",
      description: "main.tf has a terraform_data resource with lifecycle { prevent_destroy = true }",
    },
    {
      id: "create_before_destroy",
      description: "main.tf has a terraform_data resource with lifecycle { create_before_destroy = true }",
    },
    {
      id: "ignore_changes",
      description: "main.tf has a terraform_data resource with lifecycle { ignore_changes = [input] }",
    },
    {
      id: "three_resources_in_state",
      description: "terraform apply succeeded and state records 3 managed resources",
    },
  ],
  hints: [
    "The `lifecycle` block goes **inside** the resource block, at the same indentation level as `input`. Example: `resource \"terraform_data\" \"db_primary\" { input = \"...\" lifecycle { prevent_destroy = true } }`",
    "You need three separate `terraform_data` resource blocks, each with a different lifecycle rule: `db_primary` → prevent_destroy, `cert` → create_before_destroy, `cache` → ignore_changes = [input].",
    "After writing main.tf run `terraform init && terraform validate` to check syntax before applying. Common mistake: forgetting to close one of the braces.",
    "To verify prevent_destroy works, run `terraform destroy -target=terraform_data.db_primary -auto-approve` — you should see an error containing \"Instance cannot be destroyed\". This is expected and correct.",
  ],
  setupScript: `mkdir -p /root/tf-lab`,
  verifyScript: `
LAB=/root/tf-lab
MAIN="$LAB/main.tf"

# Task 1: prevent_destroy present
if [ -f "$MAIN" ] && grep -v '^[[:space:]]*#' "$MAIN" | grep -qE 'prevent_destroy[[:space:]]*=[[:space:]]*true'; then
  echo "CHECK:prevent_destroy:PASS:prevent_destroy = true found in main.tf."
else
  echo "CHECK:prevent_destroy:FAIL:main.tf is missing prevent_destroy = true. Add a lifecycle block with prevent_destroy = true to one resource."
fi

# Task 2: create_before_destroy present
if [ -f "$MAIN" ] && grep -v '^[[:space:]]*#' "$MAIN" | grep -qE 'create_before_destroy[[:space:]]*=[[:space:]]*true'; then
  echo "CHECK:create_before_destroy:PASS:create_before_destroy = true found in main.tf."
else
  echo "CHECK:create_before_destroy:FAIL:main.tf is missing create_before_destroy = true. Add it in a lifecycle block on the cert resource."
fi

# Task 3: ignore_changes present
if [ -f "$MAIN" ] && grep -v '^[[:space:]]*#' "$MAIN" | grep -qE 'ignore_changes[[:space:]]*='; then
  echo "CHECK:ignore_changes:PASS:ignore_changes found in main.tf."
else
  echo "CHECK:ignore_changes:FAIL:main.tf is missing ignore_changes. Add lifecycle { ignore_changes = [input] } to the cache resource."
fi

# Task 4: 3 managed resources in state
STATE="$LAB/terraform.tfstate"
if [ -f "$STATE" ]; then
  MANAGED=$(grep -c '"mode":[[:space:]]*"managed"' "$STATE" 2>/dev/null || echo 0)
  if [ "$MANAGED" -ge 3 ]; then
    echo "CHECK:three_resources_in_state:PASS:terraform.tfstate records $MANAGED managed resource(s)."
  else
    echo "CHECK:three_resources_in_state:FAIL:Expected 3 managed resources in state, found $MANAGED. Run terraform apply -auto-approve."
  fi
else
  echo "CHECK:three_resources_in_state:FAIL:No terraform.tfstate found. Run: terraform init && terraform apply -auto-approve"
fi
`,
};
