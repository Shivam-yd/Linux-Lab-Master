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
import { db } from "@workspace/db";
import { remoteLabsTable } from "@workspace/db/schema";

// ── Hardcoded labs (always available) ─────────────────────────────────────────
// Terraform labs are fully covered by the YAML-based remote labs (labs/terraform/).
// Only Linux built-ins that have no YAML equivalent remain here.

export const BUILTIN_LABS: LabDefinition[] = [
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
].sort((a, b) => a.order - b.order);

// Keep the synchronous export for any code that only needs built-ins
// (e.g. warmLabImages).  Routes should call getAllLabs() instead.
export const LABS = BUILTIN_LABS;

// ── Remote labs (fetched from GitHub, stored in DB) ───────────────────────────

/** Returns labs stored in the remote_labs table. */
async function getRemoteLabs(): Promise<LabDefinition[]> {
  try {
    const rows = await db.select().from(remoteLabsTable);
    return rows.map((r) => r.definition as unknown as LabDefinition);
  } catch {
    // DB might not be ready during very early startup — fail gracefully
    return [];
  }
}

/**
 * Returns the merged lab list: built-in labs + remote labs from GitHub.
 * Remote labs with the same ID as a built-in lab override the built-in.
 * Result is sorted by `order` ascending.
 */
export async function getAllLabs(): Promise<LabDefinition[]> {
  const remote = await getRemoteLabs();
  const remoteById = new Map(remote.map((l) => [l.id, l]));

  // Start with built-ins, override any whose ID exists in remote
  const merged = BUILTIN_LABS.map((l) => remoteById.get(l.id) ?? l);
  // Append remote labs that aren't in built-ins
  for (const lab of remote) {
    if (!BUILTIN_LABS.some((b) => b.id === lab.id)) {
      merged.push(lab);
    }
  }
  return merged.sort((a, b) => a.order - b.order);
}

/**
 * Looks up a lab by ID — checks remote first, then built-ins.
 * Use this in routes so GitHub-pushed labs are always found.
 */
export async function getLabByIdAsync(labId: string): Promise<LabDefinition | undefined> {
  const all = await getAllLabs();
  return all.find((l) => l.id === labId);
}

/** Synchronous lookup (built-ins only) — kept for backward compatibility. */
export function getLabById(labId: string): LabDefinition | undefined {
  return BUILTIN_LABS.find((l) => l.id === labId);
}
