import { execFile } from "node:child_process";
import { access, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const BACKUP_TIMEOUT_MS = 10 * 60 * 1_000;

export type BackupFile = {
  filename: string;
  sizeBytes: number;
  createdAt: string;
  checksumPresent: boolean;
};

export type BackupStatus = {
  available: boolean;
  policy: {
    retention: 1;
    schedule: "02:00";
    verification: "checksum and PostgreSQL archive readability";
  };
  current: BackupFile | null;
  message: string;
};

function backupDir(): string {
  return process.env.BACKUP_DIR ?? path.resolve(process.cwd(), "backups/postgres");
}

function scriptsDir(): string {
  const candidates = [
    path.resolve(import.meta.dirname, "../../../scripts/backup"),
    path.resolve(import.meta.dirname, "../scripts/backup"),
  ];
  return candidates.find((candidate) => {
    return existsSync(path.join(candidate, "create-backup.sh"));
  }) ?? candidates[0];
}

async function scriptAvailable(name: string): Promise<boolean> {
  try {
    await access(path.join(scriptsDir(), name));
    return true;
  } catch {
    return false;
  }
}

async function currentBackup(): Promise<BackupFile | null> {
  let names: string[];
  try {
    names = await readdir(backupDir());
  } catch {
    return null;
  }

  const candidates = await Promise.all(
    names
      .filter((name) => /^devlabmaster-.*\.dump$/.test(name))
      .map(async (filename) => {
        const fullPath = path.join(backupDir(), filename);
        const file = await stat(fullPath);
        return {
          filename,
          sizeBytes: file.size,
          createdAt: file.mtime.toISOString(),
          checksumPresent: await scriptAvailable("verify-backup.sh")
            && await access(`${fullPath}.sha256`).then(() => true).catch(() => false),
        };
      }),
  );
  return candidates.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

export async function getBackupStatus(): Promise<BackupStatus> {
  const available = await scriptAvailable("create-backup.sh");
  return {
    available,
    policy: {
      retention: 1,
      schedule: "02:00",
      verification: "checksum and PostgreSQL archive readability",
    },
    current: await currentBackup(),
    message: available
      ? "The server-managed backup controls are available."
      : "Backup scripts are not installed in this runtime; use the deployment host scheduler.",
  };
}

async function runScript(name: string, args: string[] = []): Promise<string> {
  if (!(await scriptAvailable(name))) {
    throw new Error("Backup scripts are not installed in this runtime");
  }
  const { stdout, stderr } = await execFileAsync(
    "bash",
    [path.join(scriptsDir(), name), ...args],
    {
      env: { ...process.env, BACKUP_DIR: backupDir() },
      timeout: BACKUP_TIMEOUT_MS,
      maxBuffer: 64 * 1024,
    },
  );
  return `${stdout}${stderr}`.trim().slice(-2_000);
}

export async function runBackupNow(): Promise<{ output: string; backup: BackupFile | null }> {
  const output = await runScript("create-backup.sh");
  return { output, backup: await currentBackup() };
}

export async function verifyCurrentBackup(): Promise<{ output: string; backup: BackupFile }> {
  const backup = await currentBackup();
  if (!backup) throw new Error("No backup is available to verify");
  const output = await runScript("verify-backup.sh", [path.join(backupDir(), backup.filename)]);
  return { output, backup };
}