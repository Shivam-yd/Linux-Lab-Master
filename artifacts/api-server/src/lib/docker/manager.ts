import Docker from "dockerode";
import { Writable } from "node:stream";
import { db } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  labSessionsTable,
  labProgressTable,
  type LabSessionRow,
} from "@workspace/db/schema";
import { getLabByIdAsync } from "../labs/registry";
import { logger } from "../logger";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

const CONTAINER_LABEL = "linuxlabs.managed";

// Safety limits for exec (both setup scripts and verify scripts share these).
// Verify scripts should finish in seconds; 30 s is generous while still
// preventing a hung script from blocking an API worker indefinitely.
const EXEC_TIMEOUT_MS  = 30_000;        // 30 s max wall-clock time
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024; // 2 MB — prevent OOM from chatty scripts

function containerName(studentId: string, labId: string): string {
  const safeStudent = studentId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24);
  const safeLab = labId.replace(/[^a-zA-Z0-9-]/g, "");
  return `linuxlabs-${safeStudent}-${safeLab}`;
}

async function runExec(
  container: Docker.Container,
  cmd: string[],
  opts: { user?: string; cwd?: string; timeoutMs?: number } = {},
): Promise<{ exitCode: number; output: string }> {
  const timeoutMs = opts.timeoutMs ?? EXEC_TIMEOUT_MS;

  const exec = await container.exec({
    Cmd: cmd,
    User: opts.user ?? "root",
    WorkingDir: opts.cwd,
    AttachStdout: true,
    AttachStderr: true,
  });
  const stream = await exec.start({ hijack: true, stdin: false });

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  // Race the exec stream against a hard timeout so a hung or infinite-looping
  // verify/setup script can never block an API worker indefinitely.
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      new Promise<void>((resolve, reject) => {
        const sink = new Writable({
          write(chunk: Buffer, _enc, callback) {
            totalBytes += chunk.length;
            if (totalBytes > MAX_OUTPUT_BYTES) {
              callback(new Error(`Exec output exceeded ${MAX_OUTPUT_BYTES / 1024 / 1024} MB limit — script may be runaway`));
              return;
            }
            chunks.push(chunk);
            callback();
          },
        });
        container.modem.demuxStream(stream, sink, sink);
        stream.on("end", resolve);
        stream.on("error", reject);
      }),
      new Promise<void>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          stream.destroy();
          reject(new Error(`Exec timed out after ${timeoutMs / 1000}s — verify/setup script did not finish`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
  }

  const inspect = await exec.inspect();
  return { exitCode: inspect.ExitCode ?? -1, output: Buffer.concat(chunks).toString("utf8") };
}

async function ensureImagePresent(image: string): Promise<void> {
  const list = await docker.listImages({ filters: { reference: [image] } });
  if (list.length > 0) return; // already cached locally
  logger.info({ image }, "Image not cached — pulling on demand");
  await new Promise<void>((resolve, reject) => {
    docker.pull(image, (err: Error | null, stream?: NodeJS.ReadableStream) => {
      if (err || !stream) return reject(err ?? new Error("docker.pull returned no stream"));
      docker.modem.followProgress(stream, (progressErr: Error | null) => {
        if (progressErr) return reject(progressErr);
        resolve();
      });
    });
  });
  logger.info({ image }, "Image pulled successfully");
}

async function findExistingContainer(name: string): Promise<Docker.Container | null> {
  const list = await docker.listContainers({ all: true, filters: { name: [name] } });
  const match = list.find((c) => c.Names.some((n) => n === `/${name}`));
  return match ? docker.getContainer(match.Id) : null;
}

/**
 * Atomic upsert using ON CONFLICT DO UPDATE — eliminates the read-then-write
 * race that previously allowed two concurrent requests to create duplicate rows.
 */
async function upsertSessionRow(
  studentId: string,
  labId: string,
  patch: Partial<LabSessionRow>,
): Promise<LabSessionRow> {
  const [row] = await db
    .insert(labSessionsTable)
    .values({
      studentId,
      labId,
      status: "starting",
      ...patch,
    })
    .onConflictDoUpdate({
      target: [labSessionsTable.studentId, labSessionsTable.labId],
      set: {
        ...patch,
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!row) throw new Error("Failed to upsert lab session row");
  return row;
}

export async function getSessionRow(studentId: string, labId: string): Promise<LabSessionRow | undefined> {
  return db.query.labSessionsTable.findFirst({
    where: and(eq(labSessionsTable.studentId, studentId), eq(labSessionsTable.labId, labId)),
  });
}

/**
 * Per-(studentId, labId) mutex that prevents two concurrent HTTP requests from
 * both racing through findExistingContainer → createContainer and triggering a
 * Docker 409 name-conflict that was previously caught as status="error".
 */
const _startingKeys = new Set<string>();

export async function startSession(studentId: string, labId: string): Promise<LabSessionRow> {
  const lab = await getLabByIdAsync(labId);
  if (!lab) throw new Error(`Unknown lab: ${labId}`);

  const key = `${studentId}:${labId}`;

  // If a start is already in progress for this student+lab, wait for it to
  // finish and return the resulting session row rather than racing it.
  if (_startingKeys.has(key)) {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1_000));
      const row = await getSessionRow(studentId, labId);
      if (row && row.status !== "starting") return row;
    }
    // Fall through and try anyway if the wait expires.
  }

  _startingKeys.add(key);
  try {
    const name = containerName(studentId, labId);
    const existing = await findExistingContainer(name);
    if (existing) {
      const info = await existing.inspect();
      if (info.State.Running) {
        return upsertSessionRow(studentId, labId, {
          containerId: existing.id,
          containerName: name,
          status: "running",
          errorMessage: null,
        });
      }
      // Stale/stopped container from a previous crash — remove and recreate.
      await existing.remove({ force: true }).catch(() => undefined);
    }

    await upsertSessionRow(studentId, labId, { status: "starting", errorMessage: null });

    try {
      await ensureImagePresent(lab.image);
      let container: Docker.Container;
      try {
        container = await docker.createContainer({
          Image: lab.image,
          name,
          // Keep the container alive with `sleep infinity`.
          // Two cases:
          //   • Normal images (no custom entrypoint): leave Entrypoint unset so
          //     Docker uses the image default, and set Cmd = ["sleep","infinity"].
          //   • Images with a custom ENTRYPOINT (e.g. hashicorp/terraform uses
          //     ["/bin/terraform"]): override Entrypoint with the keepalive command
          //     directly and leave Cmd empty — otherwise Docker concatenates them
          //     and runs `sleep infinity sleep infinity`, causing an immediate exit.
          ...(lab.entrypoint
            ? { Entrypoint: lab.entrypoint, Cmd: [] }
            : { Cmd: ["sleep", "infinity"] }),
          Tty: false,
          Labels: { [CONTAINER_LABEL]: "true", labId, studentId },
          HostConfig: {
            AutoRemove: false,
            Memory: 384 * 1024 * 1024,
            NanoCpus: 1_000_000_000,
            PidsLimit: 256,
            // Run a real init (tini) as PID 1 so killed background processes are
            // reaped instead of piling up as zombies. Without this, `pkill`/`kill`
            // inside a lab leaves a defunct process that tools like `pgrep -f`
            // can still match (via /proc/pid/comm), causing verify scripts to
            // report a process as "still running" after it was actually killed.
            Init: true,
          },
        });
      } catch (createErr: unknown) {
        // Docker returns 409 when a container with this name already exists —
        // another concurrent request won the race. Treat the existing container
        // as our container rather than surfacing a false error.
        const isConflict =
          (createErr as { statusCode?: number })?.statusCode === 409 ||
          (createErr instanceof Error && createErr.message.includes("already in use"));
        if (isConflict) {
          const raceContainer = await findExistingContainer(name);
          if (raceContainer) {
            const info = await raceContainer.inspect();
            if (info.State.Running) {
              return upsertSessionRow(studentId, labId, {
                containerId: raceContainer.id,
                containerName: name,
                status: "running",
                errorMessage: null,
              });
            }
          }
        }
        throw createErr;
      }

      try {
        await container.start();
        const setup = await runExec(container, [lab.shell ?? "sh", "-lc", lab.setupScript], { user: "root" });
        if (setup.exitCode !== 0) {
          logger.error({ labId, studentId, output: setup.output }, "Lab setup script failed");
          throw new Error(`Setup script failed (exit ${setup.exitCode}): ${setup.output.slice(-500)}`);
        }
      } catch (setupErr) {
        // Never leave a half-provisioned container running — remove it before surfacing the error.
        await container.remove({ force: true }).catch(() => undefined);
        throw setupErr;
      }
      return upsertSessionRow(studentId, labId, {
        containerId: container.id,
        containerName: name,
        status: "running",
        errorMessage: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return upsertSessionRow(studentId, labId, {
        status: "error",
        containerId: null,
        errorMessage: message,
      });
    }
  } finally {
    _startingKeys.delete(key);
  }
}

export async function stopSession(studentId: string, labId: string): Promise<void> {
  const name = containerName(studentId, labId);
  const existing = await findExistingContainer(name);
  if (existing) {
    await existing.remove({ force: true }).catch(() => undefined);
  }
  await upsertSessionRow(studentId, labId, { status: "stopped", containerId: null });
}

export async function resetSession(studentId: string, labId: string): Promise<LabSessionRow> {
  await stopSession(studentId, labId);
  return startSession(studentId, labId);
}

export async function getRunningContainer(
  studentId: string,
  labId: string,
): Promise<Docker.Container | null> {
  const name = containerName(studentId, labId);
  const existing = await findExistingContainer(name);
  if (!existing) return null;
  const info = await existing.inspect();
  return info.State.Running ? existing : null;
}

export async function verifyLab(
  studentId: string,
  labId: string,
): Promise<{ id: string; passed: boolean; message: string }[]> {
  const lab = await getLabByIdAsync(labId);
  if (!lab) throw new Error(`Unknown lab: ${labId}`);
  const container = await getRunningContainer(studentId, labId);
  if (!container) {
    throw new Error("Lab session is not running. Start the sandbox before running checks.");
  }
  const result = await runExec(container, [lab.shell ?? "sh", "-lc", lab.verifyScript], { user: "root" });
  const taskLabelMap = new Map(lab.tasks.map((t) => [t.id, t.description]));
  const byId = new Map<string, { id: string; label: string | null; passed: boolean; message: string }>();
  const lineRe = /^CHECK:([^:]+):(PASS|FAIL):(.*)$/;
  for (const rawLine of result.output.split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = lineRe.exec(line);
    if (!match) continue;
    const [, id, verdict, message] = match;
    // Only skip lines with a missing check ID — an empty message is valid
    // (e.g. CHECK:task1:PASS: with nothing after the last colon) and should
    // not be silently dropped.
    if (!id) continue;
    byId.set(id, { id, label: taskLabelMap.get(id) ?? null, passed: verdict === "PASS", message });
  }
  if (byId.size === 0) {
    logger.warn({ labId, studentId, output: result.output }, "Verify script produced no CHECK lines");
  }
  // Guarantee exactly one result per declared task, even if the verify script
  // crashed, timed out, or otherwise failed to emit a CHECK line for one of
  // them — otherwise a missing line silently drops the denominator used to
  // decide "all checks passed" and the lab can be marked complete while a
  // task was never actually verified.
  const checks = lab.tasks.map((task) => {
    const found = byId.get(task.id);
    if (found) return found;
    logger.warn({ labId, studentId, taskId: task.id }, "Verify script did not report a result for task");
    return {
      id: task.id,
      label: task.description,
      passed: false,
      message: "Verification script did not report a result for this check — click Verify again.",
    };
  });
  return checks;
}

export async function recordProgress(
  studentId: string,
  labId: string,
  checks: { passed: boolean }[],
): Promise<void> {
  const total = checks.length || 1;
  const passedCount = checks.filter((c) => c.passed).length;
  const score = Math.round((passedCount / total) * 100);
  const allPassed = checks.length > 0 && passedCount === checks.length;
  const status = allPassed ? "passed" : "in_progress";
  const now = new Date();

  // Read the current best score so we never regress it on a worse attempt.
  const [existing] = await db
    .select({ bestScore: labProgressTable.bestScore })
    .from(labProgressTable)
    .where(and(eq(labProgressTable.studentId, studentId), eq(labProgressTable.labId, labId)))
    .limit(1);
  const bestScore = Math.max(existing?.bestScore ?? 0, score);

  // Atomic upsert — no race-induced duplicate rows.
  await db
    .insert(labProgressTable)
    .values({ studentId, labId, status, bestScore, lastAttemptAt: now, lastResults: checks })
    .onConflictDoUpdate({
      target: [labProgressTable.studentId, labProgressTable.labId],
      set: { status, bestScore, lastAttemptAt: now, lastResults: checks, updatedAt: new Date() },
    });
}

export { docker };
