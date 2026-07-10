import type { LabDefinition } from "./types";
import { sshPasswordless } from "./ssh-passwordless";
import { userGroupManagement } from "./user-group-management";
import { filePermissions } from "./file-permissions";
import { cronAutomation } from "./cron-automation";
import { logForensics } from "./log-forensics";
import { backupScript } from "./backup-script";
import { linuxL1Navigation } from "./linux-l1-navigation";
import { linuxL1Files } from "./linux-l1-files";
import { linuxL1Text } from "./linux-l1-text";
import { linuxL1Processes } from "./linux-l1-processes";
import { linuxL1Environment } from "./linux-l1-environment";
import { terraformBasics } from "./terraform-basics";
import { terraformVariables } from "./terraform-variables";
import { terraformModules } from "./terraform-modules";
import { terraformCount } from "./terraform-count";
import { terraformForEach } from "./terraform-for-each";
import { terraformLifecycle } from "./terraform-lifecycle";
import { terraformWorkspaces } from "./terraform-workspaces";
import { terraformOutputsStructured } from "./terraform-outputs-structured";
import { terraformL1Intro } from "./terraform-l1-intro";
import { terraformL1Providers } from "./terraform-l1-providers";
import { terraformL1Resources } from "./terraform-l1-resources";
import { terraformL1Variables } from "./terraform-l1-variables";
import { terraformL1Outputs } from "./terraform-l1-outputs";
import { terraformL1Locals } from "./terraform-l1-locals";
import { terraformL1State } from "./terraform-l1-state";
import { terraformL1Functions } from "./terraform-l1-functions";
import { terraformL1Dependencies } from "./terraform-l1-dependencies";
import { terraformL1Count } from "./terraform-l1-count";

export const LABS: LabDefinition[] = [
  sshPasswordless,
  userGroupManagement,
  filePermissions,
  cronAutomation,
  logForensics,
  backupScript,
  linuxL1Navigation,
  linuxL1Files,
  linuxL1Text,
  linuxL1Processes,
  linuxL1Environment,
  terraformBasics,
  terraformVariables,
  terraformModules,
  terraformCount,
  terraformForEach,
  terraformLifecycle,
  terraformWorkspaces,
  terraformOutputsStructured,
  terraformL1Intro,
  terraformL1Providers,
  terraformL1Resources,
  terraformL1Variables,
  terraformL1Outputs,
  terraformL1Locals,
  terraformL1State,
  terraformL1Functions,
  terraformL1Dependencies,
  terraformL1Count,
].sort((a, b) => a.order - b.order);

const LABS_BY_ID = new Map(LABS.map((lab) => [lab.id, lab]));

export function getLabById(labId: string): LabDefinition | undefined {
  return LABS_BY_ID.get(labId);
}
