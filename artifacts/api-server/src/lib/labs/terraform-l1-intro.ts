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

Save the output so the check can verify you ran it:

\`\`\`sh
terraform init 2>&1 | tee init-output.txt
\`\`\`

Terraform prepares the working directory. For built-in providers the step is instant, but it must be run before any other commands.

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
      description: "terraform init has been run (init-output.txt saved with init output)",
    },
    {
      id: "apply_succeeded",
      description: "terraform apply has been run (state file exists as evidence)",
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

# Task 2: terraform init was run — student saves output: terraform init 2>&1 | tee init-output.txt
INIT_OUT="$LAB/init-output.txt"
if [ -f "$INIT_OUT" ] && grep -qi 'initialized\|initialised\|already been' "$INIT_OUT" 2>/dev/null; then
  echo "CHECK:init_done:PASS:init-output.txt confirms Terraform was initialised."
elif [ -f "$INIT_OUT" ]; then
  echo "CHECK:init_done:FAIL:init-output.txt found but does not confirm init ran successfully. Run: terraform init 2>&1 | tee init-output.txt"
else
  echo "CHECK:init_done:FAIL:init-output.txt not found. Run: terraform init 2>&1 | tee init-output.txt"
fi

# Task 3: apply has been run — state file exists.
# serial >= 1 means at least one apply has occurred (remains true even after destroy).
STATE="$LAB/terraform.tfstate"
if [ -f "$STATE" ]; then
  MANAGED=$(grep -c '"mode":[[:space:]]*"managed"' "$STATE" 2>/dev/null)
  SERIAL=$(grep -oE '"serial":[[:space:]]*[0-9]+' "$STATE" 2>/dev/null | grep -oE '[0-9]+' | head -1)
  if [ -z "$SERIAL" ]; then SERIAL=0; fi
  if [ "$MANAGED" -gt 0 ] || [ "$SERIAL" -ge 1 ]; then
    echo "CHECK:apply_succeeded:PASS:terraform.tfstate exists (serial=$SERIAL, managed=$MANAGED) — apply has been run."
  else
    echo "CHECK:apply_succeeded:FAIL:terraform.tfstate exists but shows no evidence of a successful apply. Run: terraform apply -auto-approve"
  fi
else
  echo "CHECK:apply_succeeded:FAIL:No terraform.tfstate found. Run: terraform apply -auto-approve"
fi

# Task 4: destroy has run — state file exists but has zero managed resources.
# Require serial >= 1 so a blank manually-created file cannot fake this.
if [ -f "$STATE" ]; then
  MANAGED=$(grep -c '"mode":[[:space:]]*"managed"' "$STATE" 2>/dev/null)
  SERIAL=$(grep -oE '"serial":[[:space:]]*[0-9]+' "$STATE" 2>/dev/null | grep -oE '[0-9]+' | head -1)
  if [ -z "$SERIAL" ]; then SERIAL=0; fi
  if [ "$MANAGED" -eq 0 ] && [ "$SERIAL" -ge 1 ]; then
    echo "CHECK:destroy_done:PASS:terraform.tfstate has no managed resources (serial=$SERIAL) — destroy succeeded."
  elif [ "$MANAGED" -gt 0 ]; then
    echo "CHECK:destroy_done:FAIL:$MANAGED resource(s) still in state. Run: terraform destroy -auto-approve"
  else
    echo "CHECK:destroy_done:FAIL:State file looks empty or uninitialised. Complete the apply step first, then run: terraform destroy -auto-approve"
  fi
else
  echo "CHECK:destroy_done:FAIL:terraform.tfstate not found. Run apply first, then: terraform destroy -auto-approve"
fi
`,
};
