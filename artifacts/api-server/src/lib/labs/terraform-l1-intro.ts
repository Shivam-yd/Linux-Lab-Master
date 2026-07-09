import type { LabDefinition } from "./types";

export const terraformL1Intro: LabDefinition = {
  id: "terraform-l1-intro",
  track: "terraform",
  level: 1,
  title: "Lab 01: Introduction to Terraform",
  category: "Infrastructure as Code",
  difficulty: "beginner",
  summary:
    "Create your first Terraform project and walk through the complete IaC workflow — write, init, validate, plan, apply, and destroy.",
  estimatedMinutes: 20,
  order: 20,
  image: "hashicorp/terraform:1.9",
  entrypoint: ["sleep", "infinity"],
  shell: "sh",
  terminals: [{ name: "main", user: "root", cwd: "/root/tf-lab" }],
  objectives: [
    "Write a valid Terraform configuration with a resource block",
    "Run terraform init to initialise the working directory",
    "Validate and preview the execution plan",
    "Apply the configuration and confirm the state file is created",
    "Destroy the infrastructure and verify state is clean",
  ],
  instructions: `## Scenario

Your organisation is adopting Infrastructure as Code (IaC). As part of the onboarding process you need to create your first Terraform project and verify the complete workflow — from initialisation all the way through to destruction.

The working directory is already created at \`/root/tf-lab\`. Write your \`.tf\` files there and run every Terraform command from the same directory.

**Tip — no text editor is installed.** Use a heredoc to create files:

\`\`\`sh
cat > main.tf <<'EOF'
# your HCL here
EOF
\`\`\`

---

## Steps

### 1 — Write the configuration

Create \`main.tf\` with a \`terraform\` block that pins the minimum Terraform version, and a \`terraform_data\` resource (built into Terraform — no provider download needed):

\`\`\`hcl
terraform {
  required_version = ">= 1.0"
}

resource "terraform_data" "hello" {
  input = "Hello, Terraform!"
}
\`\`\`

### 2 — Initialise the project

\`\`\`sh
terraform init
\`\`\`

This creates the \`.terraform/\` directory and the lock file \`.terraform.lock.hcl\`.

### 3 — Validate the configuration

\`\`\`sh
terraform validate
\`\`\`

A green "Success!" message means the HCL is syntactically and semantically correct.

### 4 — Preview the execution plan

\`\`\`sh
terraform plan
\`\`\`

Terraform shows what it *would* do without making any changes. Confirm that one resource is planned for creation.

### 5 — Apply the configuration

\`\`\`sh
terraform apply -auto-approve
\`\`\`

Terraform creates the resource and writes the state to \`terraform.tfstate\`. After apply, run:

\`\`\`sh
cat terraform.tfstate
\`\`\`

### 6 — Destroy the infrastructure

\`\`\`sh
terraform destroy -auto-approve
\`\`\`

Terraform removes all managed resources. The state file is updated to reflect an empty infrastructure.`,
  tasks: [
    {
      id: "config_written",
      description: "main.tf exists and contains a terraform_data resource block",
    },
    {
      id: "init_done",
      description: "terraform init has been run (.terraform.lock.hcl exists)",
    },
    {
      id: "apply_succeeded",
      description: "terraform apply has run and the state file records at least one managed resource",
    },
    {
      id: "destroy_done",
      description: "terraform destroy has run and the state file contains no managed resources",
    },
  ],
  setupScript: `
mkdir -p /root/tf-lab
`,
  verifyScript: `
LAB=/root/tf-lab

# Task 1: main.tf exists and has a terraform_data resource
MAIN="$LAB/main.tf"
if [ -f "$MAIN" ] && grep -v '^[[:space:]]*#' "$MAIN" | grep -qE 'resource[[:space:]]+"terraform_data"'; then
  echo "CHECK:config_written:PASS:main.tf exists and contains a terraform_data resource block."
elif [ ! -f "$MAIN" ]; then
  echo "CHECK:config_written:FAIL:main.tf not found. Create it in /root/tf-lab with a terraform_data resource."
else
  echo "CHECK:config_written:FAIL:main.tf exists but has no terraform_data resource. Add: resource \"terraform_data\" \"hello\" { input = \"Hello, Terraform!\" }"
fi

# Task 2: terraform init has been run (.terraform.lock.hcl exists)
if [ -f "$LAB/.terraform.lock.hcl" ]; then
  echo "CHECK:init_done:PASS:.terraform.lock.hcl found — terraform init has been run."
else
  echo "CHECK:init_done:FAIL:.terraform.lock.hcl not found. Run: terraform init"
fi

# Task 3: apply has run — state file has at least one managed resource
STATE="$LAB/terraform.tfstate"
if [ -f "$STATE" ]; then
  MANAGED=$(grep -c '"mode":[[:space:]]*"managed"' "$STATE" 2>/dev/null || echo 0)
  if [ "$MANAGED" -gt 0 ]; then
    echo "CHECK:apply_succeeded:PASS:terraform.tfstate records $MANAGED managed resource(s) — apply succeeded."
  else
    echo "CHECK:apply_succeeded:FAIL:terraform.tfstate exists but contains no managed resources. Run: terraform apply -auto-approve"
  fi
else
  echo "CHECK:apply_succeeded:FAIL:No terraform.tfstate found. Run: terraform apply -auto-approve"
fi

# Task 4: destroy has run — state file has zero managed resources
if [ -f "$STATE" ]; then
  MANAGED=$(grep -c '"mode":[[:space:]]*"managed"' "$STATE" 2>/dev/null || echo 0)
  if [ "$MANAGED" -eq 0 ]; then
    echo "CHECK:destroy_done:PASS:terraform.tfstate contains no managed resources — destroy succeeded."
  else
    echo "CHECK:destroy_done:FAIL:$MANAGED resource(s) still in state. Run: terraform destroy -auto-approve"
  fi
else
  echo "CHECK:destroy_done:FAIL:terraform.tfstate not found. Run apply first, then terraform destroy -auto-approve"
fi
`,
};
