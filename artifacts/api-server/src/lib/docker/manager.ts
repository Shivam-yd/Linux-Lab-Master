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

function containerName(studentId: string, labId: string): string {
  const safeStudent = studentId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24);
  const safeLab = labId.replace(/[^a-zA-Z0-9-]/g, "");
  return `linuxlabs-${safeStudent}-${safeLab}`;
}

async function runExec(
  container: Docker.Container,
  cmd: string[],
  opts: { user?: string; cwd?: string } = {},
): Promise<{ exitCode: number; output: string }> {
  const exec = await container.exec({
    Cmd: cmd,
    User: opts.user ?? "root",
    WorkingDir: opts.cwd,
    AttachStdout: true,
    AttachStderr: true,
  });
  const stream = await exec.start({ hijack: true, stdin: false });
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    const sink = new Writable({
      write(chunk: Buffer, _enc, callback) {
        chunks.push(chunk);
        callback();
      },
    });
    container.modem.demuxStream(stream, sink, sink);
    stream.on("end", resolve);
    stream.on("error", reject);
  });
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

async function upsertSessionRow(
  studentId: string,
  labId: string,
  patch: Partial<LabSessionRow>,
): Promise<LabSessionRow> {
  const existing = await db.query.labSessionsTable.findFirst({
    where: and(eq(labSessionsTable.studentId, studentId), eq(labSessionsTable.labId, labId)),
  });
  if (existing) {
    const [updated] = await db
      .update(labSessionsTable)
      .set(patch)
      .where(eq(labSessionsTable.id, existing.id))
      .returning();
    if (!updated) throw new Error("Failed to update lab session row");
    return updated;
  }
  const [created] = await db
    .insert(labSessionsTable)
    .values({
      studentId,
      labId,
      status: "starting",
      ...patch,
    })
    .returning();
  if (!created) throw new Error("Failed to create lab session row");
  return created;
}

export async function getSessionRow(studentId: string, labId: string): Promise<LabSessionRow | undefined> {
  return db.query.labSessionsTable.findFirst({
    where: and(eq(labSessionsTable.studentId, studentId), eq(labSessionsTable.labId, labId)),
  });
}

export async function startSession(studentId: string, labId: string): Promise<LabSessionRow> {
  const lab = await getLabByIdAsync(labId);
  if (!lab) throw new Error(`Unknown lab: ${labId}`);

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
    // Stale/stopped container from a previous crash -- remove and recreate.
    await existing.remove({ force: true }).catch(() => undefined);
  }

  await upsertSessionRow(studentId, labId, { status: "starting", errorMessage: null });

  try {
    await ensureImagePresent(lab.image);
    const container = await docker.createContainer({
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
    try {
      await container.start();
      const setup = await runExec(container, [lab.shell ?? "sh", "-lc", lab.setupScript], { user: "root" });
      if (setup.exitCode !== 0) {
        logger.error({ labId, studentId, output: setup.output }, "Lab setup script failed");
        throw new Error(`Setup script failed (exit ${setup.exitCode}): ${setup.output.slice(-500)}`);
      }
    } catch (setupErr) {
      // Never leave a half-provisioned container running -- remove it before surfacing the error.
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
  const checks: { id: string; label: string | null; passed: boolean; message: string }[] = [];
  const lineRe = /^CHECK:([^:]+):(PASS|FAIL):(.*)$/;
  for (const rawLine of result.output.split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = lineRe.exec(line);
    if (!match) continue;
    const [, id, verdict, message] = match;
    if (!id || !message) continue;
    checks.push({ id, label: taskLabelMap.get(id) ?? null, passed: verdict === "PASS", message });
  }
  if (checks.length === 0) {
    logger.warn({ labId, studentId, output: result.output }, "Verify script produced no CHECK lines");
  }
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

  const existing = await db.query.labProgressTable.findFirst({
    where: and(eq(labProgressTable.studentId, studentId), eq(labProgressTable.labId, labId)),
  });
  const status = allPassed ? "passed" : "in_progress";
  const bestScore = Math.max(existing?.bestScore ?? 0, score);
  const now = new Date();

  if (existing) {
    await db
      .update(labProgressTable)
      .set({ status, bestScore, lastAttemptAt: now, lastResults: checks })
      .where(eq(labProgressTable.id, existing.id));
  } else {
    await db.insert(labProgressTable).values({
      studentId,
      labId,
      status,
      bestScore,
      lastAttemptAt: now,
      lastResults: checks,
    });
  }
}

export { docker };
