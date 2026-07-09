import type { LabDefinition } from "./types";
import { sshPasswordless } from "./ssh-passwordless";
import { userGroupManagement } from "./user-group-management";
import { filePermissions } from "./file-permissions";
import { cronAutomation } from "./cron-automation";
import { logForensics } from "./log-forensics";
import { backupScript } from "./backup-script";
import { terraformBasics } from "./terraform-basics";

export const LABS: LabDefinition[] = [
  sshPasswordless,
  userGroupManagement,
  filePermissions,
  cronAutomation,
  logForensics,
  backupScript,
  terraformBasics,
].sort((a, b) => a.order - b.order);

const LABS_BY_ID = new Map(LABS.map((lab) => [lab.id, lab]));

export function getLabById(labId: string): LabDefinition | undefined {
  return LABS_BY_ID.get(labId);
}
