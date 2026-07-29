/**
 * GitHub Lab Sync Service
 *
 * Fetches YAML lab definitions from:
 *   https://github.com/Shivam-yd/Linux-Lab-Master  (labs/ directory)
 *
 * On each sync it:
 *   1. Lists all *.yaml files in the repo's labs/ folder (recursive)
 *   2. Downloads & parses each one, validates with Zod
 *   3. Upserts into `remote_labs` DB table (checks SHA to skip unchanged files)
 *   4. Writes one row to `lab_sync_log`
 *
 * Called at startup (5 s delay) and then every POLL_INTERVAL_MS automatically.
 * Also exported so the POST /labs/sync route can trigger it manually.
 */

import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { db } from "@workspace/db";
import { remoteLabsTable, labSyncLogTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";

// ── Config ────────────────────────────────────────────────────────────────────
const GITHUB_OWNER    = "Shivam-yd";
const GITHUB_REPO     = "Linux-Lab-Master";
const LABS_PATH       = "labs";
const POLL_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Lab IDs that are permanently excluded from sync.
 * Use this to suppress duplicate or retired labs that still exist in the
 * upstream GitHub repo but have been superseded by better YAML equivalents.
 */
const SYNC_DENY_LIST = new Set([
  "git-gitignore",        // duplicate of git-gitignore-basics
  "git-tags-basics",      // duplicate of git-tagging
  "jenkins-pipeline-script", // duplicate of jenkins-pipeline-job
]);

// Optional: set GITHUB_TOKEN env var to raise rate limit from 60 → 5 000 req/hr
const githubHeaders = (): Record<string, string> => {
  const token = process.env["GITHUB_TOKEN"];
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// ── Zod schema (validates untrusted YAML before touching the DB) ──────────────
const LabTerminalSchema = z.object({
  name: z.string().min(1),
  user: z.string().min(1),
  cwd:  z.string().min(1),
});

const RemoteLabSchema = z.object({
  id:               z.string().regex(/^[a-z0-9-]+$/, "id must be kebab-case"),
  title:            z.string().min(1).max(120),
  track:            z.string().min(1).max(40),
  level:            z.number().int().min(1).max(5),
  category:         z.string().min(1).max(60),
  difficulty:       z.enum(["beginner", "intermediate", "advanced"]),
  summary:          z.string().min(1).max(300),
  estimatedMinutes: z.number().int().positive().max(480),
  order:            z.number().int().nonnegative(),
  objectives:       z.string().array().min(1),
  instructions:     z.string().min(1),
  tasks:            z.object({ id: z.string().min(1), description: z.string().min(1) }).array().min(1),
  image:            z.string().min(1),
  entrypoint:       z.string().array().optional(),
  shell:            z.enum(["bash", "sh"]).optional(),
  terminals:        LabTerminalSchema.array().min(1),
  setupScript:      z.string(),
  verifyScript:     z.string(),
  hints:            z.string().array().optional(),
});

type ValidatedLab = z.infer<typeof RemoteLabSchema>;

// ── GitHub API helpers ────────────────────────────────────────────────────────
interface GhContent {
  type: "file" | "dir" | "symlink" | "submodule";
  name: string;
  path: string;
  sha:  string;
  download_url: string | null;
}

/** Returns all YAML files found recursively under `dirPath`. */
async function listYamlFiles(dirPath: string): Promise<GhContent[]> {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${dirPath}`;
  const res = await fetch(url, { headers: githubHeaders() });

  if (res.status === 404) {
    logger.warn({ url }, "github-sync: labs directory not found in repo (not yet created?)");
    return [];
  }
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  }

  const items = await res.json() as GhContent[];
  const results: GhContent[] = [];

  for (const item of items) {
    if (item.type === "dir") {
      results.push(...await listYamlFiles(item.path));
    } else if (item.type === "file" && item.name.endsWith(".yaml")) {
      results.push(item);
    }
  }
  return results;
}

/** Downloads and validates a single YAML file. Returns null to skip the file. */
async function fetchAndValidateLab(file: GhContent): Promise<ValidatedLab | null> {
  if (!file.download_url) return null;

  const res = await fetch(file.download_url, { headers: githubHeaders() });
  if (!res.ok) {
    logger.warn({ file: file.path, status: res.status }, "github-sync: failed to download file");
    return null;
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(await res.text());
  } catch (err) {
    logger.warn({ file: file.path, err }, "github-sync: YAML parse error — skipping");
    return null;
  }

  const result = RemoteLabSchema.safeParse(parsed);
  if (!result.success) {
    logger.warn(
      { file: file.path, issues: result.error.issues },
      "github-sync: lab YAML failed schema validation — skipping",
    );
    return null;
  }
  return result.data;
}

// ── Core sync logic ───────────────────────────────────────────────────────────

export interface SyncResult {
  status: "success" | "error" | "skipped";
  labsAdded: number;
  labsUpdated: number;
  totalRemote: number;
  errorMessage?: string;
}

// Simple mutex — prevents concurrent background + manual syncs
let _syncRunning = false;

export async function runSync(triggeredBy: "auto" | "manual" = "auto"): Promise<SyncResult> {
  if (_syncRunning) {
    logger.info("github-sync: sync already in progress, skipping");
    const rows = await db.select().from(remoteLabsTable).catch(() => []);
    return { status: "skipped", labsAdded: 0, labsUpdated: 0, totalRemote: rows.length };
  }

  _syncRunning = true;
  const startedAt = Date.now();
  let labsAdded   = 0;
  let labsUpdated = 0;

  try {
    logger.info({ triggeredBy }, "github-sync: starting sync");

    const files = await listYamlFiles(LABS_PATH);
    logger.info({ count: files.length }, "github-sync: found YAML files");

    // Build a map of id → current SHA from the DB for change detection
    const existingRows = await db.select().from(remoteLabsTable);
    const shaById = new Map(existingRows.map((r) => [r.id, r.sha]));

    for (const file of files) {
      const def = await fetchAndValidateLab(file);
      if (!def) continue;

      if (SYNC_DENY_LIST.has(def.id)) {
        logger.debug({ labId: def.id }, "github-sync: skipping denied lab");
        continue;
      }

      const currentSha = shaById.get(def.id);

      if (currentSha === undefined) {
        // New lab — insert
        await db.insert(remoteLabsTable).values({
          id:         def.id,
          definition: def as any,
          sha:        file.sha,
        });
        labsAdded++;
        logger.info({ labId: def.id }, "github-sync: added lab");
      } else if (currentSha !== file.sha) {
        // Existing lab, file changed — update
        await db
          .update(remoteLabsTable)
          .set({ definition: def as any, sha: file.sha })
          .where(eq(remoteLabsTable.id, def.id));
        labsUpdated++;
        logger.info({ labId: def.id }, "github-sync: updated lab");
      }
      // else: SHA unchanged — skip
    }

    const totalRemote = (await db.select().from(remoteLabsTable)).length;

    await db.insert(labSyncLogTable).values({
      status:       "success",
      labsAdded,
      labsUpdated,
      totalRemote,
      triggeredBy,
    });

    logger.info(
      { labsAdded, labsUpdated, totalRemote, elapsedMs: Date.now() - startedAt },
      "github-sync: done",
    );
    return { status: "success", labsAdded, labsUpdated, totalRemote };

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "github-sync: sync failed");

    await db.insert(labSyncLogTable).values({
      status: "error", labsAdded, labsUpdated, totalRemote: 0, errorMessage, triggeredBy,
    }).catch(() => {});

    return { status: "error", labsAdded, labsUpdated, totalRemote: 0, errorMessage };
  } finally {
    _syncRunning = false;
  }
}

// ── Background polling ────────────────────────────────────────────────────────

let _pollTimer: ReturnType<typeof setTimeout> | null = null;

export function startBackgroundSync(): void {
  setTimeout(() => { void runSync("auto").catch(() => {}); }, 5_000);

  _pollTimer = setInterval(() => {
    void runSync("auto").catch(() => {});
  }, POLL_INTERVAL_MS);

  logger.info({ intervalMs: POLL_INTERVAL_MS }, "github-sync: background polling started");
}

export function stopBackgroundSync(): void {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
}

// ── Status helper (for GET /labs/sync/status) ─────────────────────────────────
export async function getLastSyncStatus() {
  const [allRows, logRows] = await Promise.all([
    db.select().from(remoteLabsTable),
    db.select().from(labSyncLogTable),
  ]);

  const last = logRows.sort((a, b) => b.id - a.id)[0] ?? null;

  return {
    lastSync: last
      ? {
          status:       last.status,
          labsAdded:    last.labsAdded,
          labsUpdated:  last.labsUpdated,
          totalRemote:  last.totalRemote,
          errorMessage: last.errorMessage ?? null,
          triggeredBy:  last.triggeredBy,
          syncedAt:     last.syncedAt,
        }
      : null,
    totalRemote: allRows.length,
  };
}
