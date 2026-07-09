import type { LabDefinition } from "./types";

export const terraformWorkspaces: LabDefinition = {
  id: "terraform-workspaces",
  track: "terraform",
  level: 1,
  title: "Terraform Workspaces: Isolate Dev and Prod State",
  category: "Infrastructure as Code",
  difficulty: "beginner",
  summary:
    "Create separate dev and prod Terraform workspaces, apply different configurations in each, and confirm that their state files are fully isolated.",
  estimatedMinutes: 25,
  order: 13,
  image: "hashicorp/terraform:1.9",
  entrypoint: ["sleep", "infinity"],
  shell: "sh",
  terminals: [{ name: "main", user: "root", cwd: "/root/tf-lab" }],
  objectives: [
    "Create 'dev' and 'prod' workspaces with terraform workspace new",
    "Use terraform.workspace in resource input to make configs environment-aware",
    "Apply in both workspaces and confirm state isolation",
    "Switch back to default and verify it has no managed resources",
  ],
  instructions: `## Scenario

The Nautilus DevOps team wants \`dev\` and \`prod\` environments to share the same \`.tf\` source files but maintain **completely separate state files** so a \`terraform apply\` in dev never touches prod. Terraform workspaces solve this: each workspace gets its own state, yet the config is identical.

Working directory: \`/root/tf-lab\`

**Note:** Use heredocs to create files (no editor installed):
\`\`\`sh
cat > main.tf <<'EOF'
# HCL here
EOF
\`\`\`

---

## Tasks

### 1. Write \`main.tf\` that reads \`terraform.workspace\`

The built-in \`terraform.workspace\` string holds the active workspace name (\`default\`, \`dev\`, \`prod\`, etc.):

\`\`\`hcl
resource "terraform_data" "env_config" {
  input = "nautilus-config-\${terraform.workspace}"
}
\`\`\`

### 2. Create the \`dev\` workspace and apply

\`\`\`sh
terraform init
terraform workspace new dev
# Prompt confirms: Created and switched to workspace "dev"

terraform apply -auto-approve
# State is written to terraform.tfstate.d/dev/terraform.tfstate
\`\`\`

### 3. Create the \`prod\` workspace and apply

\`\`\`sh
terraform workspace new prod
terraform apply -auto-approve
# State is written to terraform.tfstate.d/prod/terraform.tfstate
\`\`\`

### 4. Verify state isolation

Switch back to \`default\` and confirm it has no resources:

\`\`\`sh
terraform workspace select default
terraform state list
# Should return nothing (empty)
\`\`\`

Switch to \`dev\` and check:

\`\`\`sh
terraform workspace select dev
terraform state list
# Should show: terraform_data.env_config
terraform output
# nautilus-config-dev
\`\`\`

## Notes

- Workspace state is stored in \`terraform.tfstate.d/<workspace>/terraform.tfstate\`.
- The \`default\` workspace uses the root \`terraform.tfstate\` file.
- \`terraform workspace list\` shows all workspaces; the active one has a \`*\` prefix.
- Workspaces share the same backend and provider config — only state is isolated.
- **Password used in this lab:** none — this lab uses the built-in \`terraform_data\` resource only.`,
  tasks: [
    {
      id: "workspace_in_config",
      description: "main.tf references terraform.workspace in a resource input",
    },
    {
      id: "dev_workspace_exists",
      description: "The 'dev' workspace exists (terraform.tfstate.d/dev/ directory present)",
    },
    {
      id: "prod_workspace_exists",
      description: "The 'prod' workspace exists (terraform.tfstate.d/prod/ directory present)",
    },
    {
      id: "both_workspaces_applied",
      description: "Both dev and prod workspace state files record at least 1 managed resource each",
    },
  ],
  hints: [
    "Write main.tf with a single terraform_data resource that uses `terraform.workspace` in its input string: `input = \"nautilus-config-\\${terraform.workspace}\"`.",
    "Run `terraform init` first (only needed once). Then `terraform workspace new dev` creates and switches to dev. After that, `terraform apply -auto-approve` writes to dev's state.",
    "Repeat for prod: `terraform workspace new prod` then `terraform apply -auto-approve`. You should now have both `terraform.tfstate.d/dev/` and `terraform.tfstate.d/prod/` directories.",
    "To verify isolation: `terraform workspace select default && terraform state list` should print nothing (default was never applied to). Then `terraform workspace select dev && terraform output` should show `nautilus-config-dev`.",
  ],
  setupScript: `mkdir -p /root/tf-lab`,
  verifyScript: `
LAB=/root/tf-lab
MAIN="$LAB/main.tf"

# Task 1: main.tf references terraform.workspace
if [ -f "$MAIN" ] && grep -v '^[[:space:]]*#' "$MAIN" | grep -qE 'terraform\.workspace'; then
  echo "CHECK:workspace_in_config:PASS:terraform.workspace reference found in main.tf."
else
  echo "CHECK:workspace_in_config:FAIL:main.tf does not reference terraform.workspace. Add it to the resource input, e.g.: input = \"config-\${terraform.workspace}\""
fi

# Task 2: dev workspace directory exists
if [ -d "$LAB/terraform.tfstate.d/dev" ]; then
  echo "CHECK:dev_workspace_exists:PASS:terraform.tfstate.d/dev directory exists."
else
  echo "CHECK:dev_workspace_exists:FAIL:terraform.tfstate.d/dev not found. Run: terraform workspace new dev"
fi

# Task 3: prod workspace directory exists
if [ -d "$LAB/terraform.tfstate.d/prod" ]; then
  echo "CHECK:prod_workspace_exists:PASS:terraform.tfstate.d/prod directory exists."
else
  echo "CHECK:prod_workspace_exists:FAIL:terraform.tfstate.d/prod not found. Run: terraform workspace new prod && terraform apply -auto-approve"
fi

# Task 4: both state files record at least 1 managed resource
DEV_STATE="$LAB/terraform.tfstate.d/dev/terraform.tfstate"
PROD_STATE="$LAB/terraform.tfstate.d/prod/terraform.tfstate"
DEV_MANAGED=0
PROD_MANAGED=0
[ -f "$DEV_STATE" ]  && DEV_MANAGED=$(grep -c '"mode":[[:space:]]*"managed"' "$DEV_STATE"  2>/dev/null || echo 0)
[ -f "$PROD_STATE" ] && PROD_MANAGED=$(grep -c '"mode":[[:space:]]*"managed"' "$PROD_STATE" 2>/dev/null || echo 0)

if [ "$DEV_MANAGED" -ge 1 ] && [ "$PROD_MANAGED" -ge 1 ]; then
  echo "CHECK:both_workspaces_applied:PASS:dev ($DEV_MANAGED resource(s)) and prod ($PROD_MANAGED resource(s)) both have managed resources."
elif [ "$DEV_MANAGED" -lt 1 ] && [ "$PROD_MANAGED" -lt 1 ]; then
  echo "CHECK:both_workspaces_applied:FAIL:Neither dev nor prod workspace has been applied. Switch to each workspace and run terraform apply -auto-approve."
elif [ "$DEV_MANAGED" -lt 1 ]; then
  echo "CHECK:both_workspaces_applied:FAIL:dev workspace has no managed resources. Run: terraform workspace select dev && terraform apply -auto-approve"
else
  echo "CHECK:both_workspaces_applied:FAIL:prod workspace has no managed resources. Run: terraform workspace select prod && terraform apply -auto-approve"
fi
`,
};
