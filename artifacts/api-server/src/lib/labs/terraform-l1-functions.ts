import type { LabDefinition } from "./types";

export const terraformL1Functions: LabDefinition = {
  id: "terraform-l1-functions",
  track: "terraform",
  level: 1,
  title: "Lab 08: Built-in Functions",
  category: "Infrastructure as Code",
  difficulty: "beginner",
  summary:
    "Use Terraform's built-in string and collection functions — upper, lower, format, join — to dynamically generate consistent resource names and configuration values.",
  estimatedMinutes: 20,
  order: 27,
  image: "hashicorp/terraform:1.9",
  entrypoint: ["sleep", "infinity"],
  shell: "sh",
  terminals: [{ name: "main", user: "root", cwd: "/root/tf-lab" }],
  objectives: [
    "Use upper() or lower() to normalise a string value",
    "Use format() or join() to compose a dynamic name",
    "Define a locals block that calls at least two built-in functions",
    "Expose function results via outputs",
    "Apply and verify the generated values",
  ],
  instructions: `## Scenario

Your team wants consistent resource names and configuration values across every environment. Use Terraform's built-in functions to dynamically generate these values instead of hardcoding them — so a single config always produces correctly formatted output regardless of how variables are supplied.

Working directory: \`/root/tf-lab\`

**Tip — no text editor installed.** Use heredocs:
\`\`\`sh
cat > main.tf <<'EOF'
# HCL here
EOF
\`\`\`

**Tip — test functions interactively with the Terraform console:**
\`\`\`sh
terraform console
> upper("hello")
> format("app-%s-%03d", "web", 1)
> join("-", ["prod", "us", "east"])
\`\`\`
(Press Ctrl+D to exit the console.)

---

## Steps

### 1 — Define variables (variables.tf)

\`\`\`hcl
variable "app_name" {
  type    = string
  default = "MyApp"
}

variable "environment" {
  type    = string
  default = "Prod"
}

variable "services" {
  type    = list(string)
  default = ["web", "api", "worker"]
}
\`\`\`

### 2 — Use functions in locals (main.tf)

\`\`\`hcl
terraform {
  required_version = ">= 1.0"
}

locals {
  app_lower    = lower(var.app_name)
  env_upper    = upper(var.environment)
  full_name    = format("%s-%s", local.app_lower, local.env_upper)
  service_list = join(", ", var.services)
}

resource "terraform_data" "naming" {
  input = {
    app      = local.app_lower
    env      = local.env_upper
    fullname = local.full_name
    services = local.service_list
  }
}
\`\`\`

### 3 — Output the results (outputs.tf)

\`\`\`hcl
output "full_name" {
  value = local.full_name
}

output "service_list" {
  value = local.service_list
}
\`\`\`

### 4 — Apply and verify

\`\`\`sh
terraform init
terraform apply -auto-approve
terraform output
\`\`\`

Expected output:
\`\`\`
full_name    = "myapp-PROD"
service_list = "web, api, worker"
\`\`\``,
  tasks: [
    {
      id: "uses_upper_lower",
      description: "main.tf uses upper() or lower() in a locals or resource block",
    },
    {
      id: "uses_format_join",
      description: "main.tf uses format() or join() to compose a value",
    },
    {
      id: "locals_with_functions",
      description: "main.tf has a locals {} block containing at least two function calls",
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
MAIN="$LAB/main.tf"

# Task 1: upper() or lower() used
HAS_CASE=0
if [ -f "$MAIN" ]; then
  grep -v '^[[:space:]]*#' "$MAIN" | grep -qE '(upper|lower)[[:space:]]*\(' && HAS_CASE=1
fi
if [ "$HAS_CASE" -eq 1 ]; then
  echo "CHECK:uses_upper_lower:PASS:upper() or lower() function found in main.tf."
else
  echo "CHECK:uses_upper_lower:FAIL:Neither upper() nor lower() found in main.tf. Use one to normalise a string, e.g.: lower(var.app_name)"
fi

# Task 2: format() or join() used
HAS_FORMAT=0
if [ -f "$MAIN" ]; then
  grep -v '^[[:space:]]*#' "$MAIN" | grep -qE '(format|join)[[:space:]]*\(' && HAS_FORMAT=1
fi
if [ "$HAS_FORMAT" -eq 1 ]; then
  echo "CHECK:uses_format_join:PASS:format() or join() function found in main.tf."
else
  echo "CHECK:uses_format_join:FAIL:Neither format() nor join() found in main.tf. Use one to compose a name, e.g.: format(\"%s-%s\", local.app_lower, local.env_upper)"
fi

# Task 3: locals block with at least 2 function calls (count inside locals {} only)
HAS_LOCALS=0
FN_COUNT=0
if [ -f "$MAIN" ]; then
  grep -v '^[[:space:]]*#' "$MAIN" | grep -qE '^[[:space:]]*locals[[:space:]]*\{' && HAS_LOCALS=1
  # Extract only the locals block content, then count lines with a function call (word immediately followed by open paren)
  FN_COUNT=$(sed -n '/^[[:space:]]*locals[[:space:]]*{/,/^[[:space:]]*}/{/^[[:space:]]*locals[[:space:]]*{/d;/^[[:space:]]*}/d;p}' "$MAIN" 2>/dev/null \
    | grep -v '^[[:space:]]*#' | grep -cE '[a-z_]+\(' || echo 0)
fi
if [ "$HAS_LOCALS" -eq 1 ] && [ "$FN_COUNT" -ge 2 ]; then
  echo "CHECK:locals_with_functions:PASS:locals {} block found with $FN_COUNT function call(s)."
elif [ "$HAS_LOCALS" -eq 0 ]; then
  echo "CHECK:locals_with_functions:FAIL:No locals {} block in main.tf. Add one that uses built-in functions like lower(), upper(), format(), join()."
else
  echo "CHECK:locals_with_functions:FAIL:locals {} block found but only $FN_COUNT function call(s) inside it — need at least 2 (e.g. lower(var.app_name) and format(\"%s-%s\", ...))."
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
