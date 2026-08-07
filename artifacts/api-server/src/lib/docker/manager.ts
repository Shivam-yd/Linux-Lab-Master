import Docker from "dockerode";
import { Writable } from "node:stream";
import http from "node:http";
import { db } from "@workspace/db";
import { eq, and, lt, ne, or, sql } from "drizzle-orm";
import {
  labSessionsTable,
  labProgressTable,
  type LabSessionRow,
} from "@workspace/db/schema";
import { getLabByIdAsync } from "../labs/registry";
import { logger } from "../logger";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

const CONTAINER_LABEL = "linuxlabs.managed";

// Containers are killed after this wall-clock time regardless of activity.
const CONTAINER_MAX_MS = 60 * 60 * 1_000; // 1 hour
const STARTING_MAX_MS = 10 * 60 * 1_000; // 10 minutes

function positiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

const MAX_ACTIVE_SESSIONS_PER_STUDENT = positiveIntEnv("MAX_ACTIVE_SESSIONS_PER_STUDENT", 2);

// Keep Docker's json-file logs bounded even if a lab service is unusually chatty.
// Docker keeps the active file plus these rotated files per container.
const CONTAINER_LOG_MAX_SIZE = "10m";
const CONTAINER_LOG_MAX_FILES = "3";

// Per-(studentId:labId) kill timers — cleared on stop/reset.
const _containerTimeouts = new Map<string, NodeJS.Timeout>();

function armTimeout(studentId: string, labId: string): void {
  const key = `${studentId}:${labId}`;
  const old = _containerTimeouts.get(key);
  if (old) clearTimeout(old);
  _containerTimeouts.set(key, setTimeout(() => {
    logger.info({ studentId, labId }, "container: 1-hour limit reached — stopping");
    void stopSession(studentId, labId).catch(() => {});
  }, CONTAINER_MAX_MS));
}

function clearTimeout_(studentId: string, labId: string): void {
  const key = `${studentId}:${labId}`;
  const t = _containerTimeouts.get(key);
  if (t) { clearTimeout(t); _containerTimeouts.delete(key); }
}

// Safety limits for exec.
// Verify scripts must be fast; setup scripts may pull Docker images inside DinD
// containers which can take 60-120 s on a cold VPS.
const EXEC_TIMEOUT_MS        = 30_000;   // 30 s for verify scripts
const SETUP_TIMEOUT_MS       = 120_000;  // 2 min for plain setup scripts
const SETUP_TIMEOUT_SERVICE  = 180_000;  // 3 min for service containers (Jenkins, etc.) that need time to boot
const JENKINS_READY_TIMEOUT  = 150_000;  // Jenkins must finish init.groovy.d after its setup restart
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024; // 2 MB — prevent OOM from chatty scripts

const JENKINS_BOOTSTRAP = `import jenkins.model.*
import hudson.security.*

def instance = Jenkins.getInstance()
def realm = new HudsonPrivateSecurityRealm(false)
realm.createAccount("admin", "admin")
instance.setSecurityRealm(realm)
def strategy = new FullControlOnceLoggedInAuthorizationStrategy()
strategy.setAllowAnonymousRead(false)
instance.setAuthorizationStrategy(strategy)
instance.save()
new File(instance.getRootDir(), ".linuxlabs-jenkins-ready").text = "ready\\n"
`;

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

function writeTarField(buffer: Buffer, offset: number, length: number, value: string): void {
  buffer.write(value.slice(0, length - 1), offset, length - 1, "utf8");
}

function tarEntry(
  name: string,
  content: Buffer,
  mode: number,
  uid: number,
  gid: number,
  type: number = 0,
): Buffer {
  const header = Buffer.alloc(512);
  writeTarField(header, 0, 100, name);
  writeTarField(header, 100, 8, `${mode.toString(8).padStart(7, "0")}\0`);
  writeTarField(header, 108, 8, `${uid.toString(8).padStart(7, "0")}\0`);
  writeTarField(header, 116, 8, `${gid.toString(8).padStart(7, "0")}\0`);
  writeTarField(header, 124, 12, `${content.length.toString(8).padStart(11, "0")}\0`);
  writeTarField(header, 136, 12, `${Math.floor(Date.now() / 1000).toString(8).padStart(11, "0")}\0`);
  header.fill(0x20, 148, 156);
  header[156] = 0x30 + type;
  writeTarField(header, 257, 8, "ustar\0");
  writeTarField(header, 265, 2, "00");
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  writeTarField(header, 148, 8, `${checksum.toString(8).padStart(6, "0")}\0 `);
  const padding = Buffer.alloc((512 - (content.length % 512)) % 512);
  return Buffer.concat([header, content, padding]);
}

async function injectJenkinsBootstrap(container: Docker.Container): Promise<void> {
  const archive = Buffer.concat([
    tarEntry("init.groovy.d/", Buffer.alloc(0), 0o755, 1000, 1000, 5),
    tarEntry(
      "init.groovy.d/01-admin.groovy",
      Buffer.from(JENKINS_BOOTSTRAP, "utf8"),
      0o644,
      1000,
      1000,
    ),
    Buffer.alloc(1024),
  ]);
  const response = await container.putArchive(archive, { path: "/var/jenkins_home" });
  if (response && typeof response.on === "function") {
    await new Promise<void>((resolve, reject) => {
      response.on("end", resolve);
      response.on("error", reject);
    });
  }
}

async function waitForJenkinsReady(container: Docker.Container): Promise<void> {
  const deadline = Date.now() + JENKINS_READY_TIMEOUT;
  let lastError = "Jenkins did not respond";

  while (Date.now() < deadline) {
    const info = await container.inspect();
    const networks = info.NetworkSettings.Networks as Record<string, { IPAddress?: string }> | undefined;
    const containerIp = Object.values(networks ?? {})
      .map((network) => network.IPAddress)
      .find((ip): ip is string => Boolean(ip));

    if (containerIp) {
      try {
        const statusCode = await new Promise<number>((resolve, reject) => {
          const request = http.get(
            { hostname: containerIp, port: 8080, path: "/jenkins/login", timeout: 3_000 },
            (response) => {
              response.resume();
              response.once("end", () => resolve(response.statusCode ?? 0));
            },
          );
          request.once("error", reject);
          request.once("timeout", () => request.destroy(new Error("Jenkins readiness request timed out")));
        });
        if (statusCode === 200) return;
        lastError = `Jenkins returned HTTP ${statusCode}`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`${lastError}; Jenkins did not become ready within ${JENKINS_READY_TIMEOUT / 1000}s`);
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

function activeSessionWhere(studentId?: string, labId?: string) {
  const active = sql`${labSessionsTable.status} IN ('starting', 'running')`;
  if (!studentId || !labId) return active;
  return and(
    active,
    or(ne(labSessionsTable.studentId, studentId), ne(labSessionsTable.labId, labId)),
  );
}

async function assertSessionCapacity(studentId: string, labId: string): Promise<void> {
  const [studentCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(labSessionsTable)
    .where(and(
      activeSessionWhere(studentId, labId),
      eq(labSessionsTable.studentId, studentId),
    ));
  if (Number(studentCount?.count ?? 0) >= MAX_ACTIVE_SESSIONS_PER_STUDENT) {
    throw new Error(`You can run up to ${MAX_ACTIVE_SESSIONS_PER_STUDENT} sandboxes at once. Stop one before starting another.`);
  }
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
const _startingRows = new Map<string, Promise<LabSessionRow>>();

export async function startSession(
  studentId: string,
  labId: string,
  options: { background?: boolean; lockHeld?: boolean } = {},
): Promise<LabSessionRow> {
  const lab = await getLabByIdAsync(labId);
  if (!lab) throw new Error(`Unknown lab: ${labId}`);

  const key = `${studentId}:${labId}`;

  if (options.background) {
    const existingStart = _startingRows.get(key);
    if (existingStart) return existingStart;

    _startingKeys.add(key);
    const startingRow = (async () => {
      const current = await getSessionRow(studentId, labId);
      if (current?.status === "running") return current;
      return upsertSessionRow(studentId, labId, { status: "starting", errorMessage: null });
    })();
    _startingRows.set(key, startingRow);

    const clearStartLock = () => {
      _startingKeys.delete(key);
      if (_startingRows.get(key) === startingRow) _startingRows.delete(key);
    };

    try {
      const row = await startingRow;
      if (row.status === "running") {
        clearStartLock();
        return row;
      }
      void startSession(studentId, labId, { lockHeld: true })
        .catch((err) => logger.error({ err, studentId, labId }, "Background lab provisioning failed"))
        .finally(clearStartLock);
      return row;
    } catch (err) {
      clearStartLock();
      throw err;
    }
  }

  // If a start is already in progress for this student+lab, wait for it to
  // finish and return the resulting session row rather than racing it.
  if (!options.lockHeld && _startingKeys.has(key)) {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1_000));
      const row = await getSessionRow(studentId, labId);
      if (row && row.status !== "starting") return row;
    }
    // Fall through and try anyway if the wait expires.
  }

  if (!options.lockHeld) _startingKeys.add(key);
  try {
    const name = containerName(studentId, labId);
    const existing = await findExistingContainer(name);
    if (existing) {
      const info = await existing.inspect();
      if (info.State.Running) {
        if (lab.image.startsWith("jenkins/")) {
          await waitForJenkinsReady(existing);
        }
        const current = await getSessionRow(studentId, labId);
        const row = await upsertSessionRow(studentId, labId, {
          containerId: existing.id,
          containerName: name,
          status: "running",
          errorMessage: null,
          startedAt: current?.startedAt ?? new Date(),
        });
        armTimeout(studentId, labId);
        return row;
      }
      // Stale/stopped container from a previous crash — remove and recreate.
      await existing.remove({ force: true }).catch(() => undefined);
    }

    await upsertSessionRow(studentId, labId, { status: "starting", errorMessage: null });

    try {
      await assertSessionCapacity(studentId, labId);
      await ensureImagePresent(lab.image);
      let container: Docker.Container;
      try {
        container = await docker.createContainer({
          Image: lab.image,
          name,
          // Keep the container alive. Three cases:
          //   • useImageCmd: image runs its own service (e.g. Jenkins) — don't
          //     override CMD/ENTRYPOINT; let the image do its thing.
          //   • Custom ENTRYPOINT labs: override Entrypoint with the keepalive
          //     command directly and leave Cmd empty — otherwise Docker
          //     concatenates them and runs `sleep infinity sleep infinity`.
          //   • Normal images: set Cmd = ["sleep","infinity"].
          ...(lab.useImageCmd
            ? {}
            : lab.entrypoint
              ? { Entrypoint: lab.entrypoint, Cmd: [] }
              : { Cmd: ["sleep", "infinity"] }),
          Tty: false,
          ...(lab.env?.length ? { Env: lab.env } : {}),
          Labels: { [CONTAINER_LABEL]: "true", labId, studentId },
          ...(lab.ports?.length
            ? { ExposedPorts: Object.fromEntries(lab.ports.map(p => [`${p}/tcp`, {}])) }
            : {}),
          HostConfig: {
            AutoRemove: false,
            // useImageCmd labs (e.g. Jenkins) need more memory than plain sandboxes.
            // Docker-in-Docker labs need the most: dockerd + inner containers.
            Memory: lab.privileged
              ? 1024 * 1024 * 1024
              : lab.useImageCmd
                ? 768 * 1024 * 1024
                : 384 * 1024 * 1024,
            NanoCpus: 1_000_000_000,
            PidsLimit: lab.privileged ? 1024 : lab.useImageCmd ? 512 : 256,
            // Run a real init (tini) for ordinary sandboxes so killed
            // background processes are reaped instead of piling up as zombies.
            // Service images already provide their own init (Jenkins ships
            // /usr/bin/tini); adding Docker's init option at all breaks
            // docker exec with an OCI setns error on this runtime.
            ...(lab.useImageCmd ? {} : { Init: true }),
            // Required for Docker-in-Docker labs that run a real dockerd inside
            // the sandbox. Only set when the lab explicitly requests it.
            Privileged: lab.privileged ?? false,
            // Explicit rotation prevents service stdout/stderr (for example,
            // Jenkins startup logs) from consuming the host disk indefinitely.
            // This applies to the outer managed container; inner DinD containers
            // remain governed by their own daemon configuration.
            LogConfig: {
              Type: "json-file",
              Config: {
                "max-size": CONTAINER_LOG_MAX_SIZE,
                "max-file": CONTAINER_LOG_MAX_FILES,
              },
            },
            // Publish any declared ports to random host ports so the proxy can
            // reach the service. HostPort: "" lets Docker pick a free port.
            ...(lab.ports?.length
              ? { PortBindings: Object.fromEntries(lab.ports.map(p => [`${p}/tcp`, [{ HostPort: "" }]])) }
              : {}),
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
              const current = await getSessionRow(studentId, labId);
              const row = await upsertSessionRow(studentId, labId, {
                containerId: raceContainer.id,
                containerName: name,
                status: "running",
                errorMessage: null,
                startedAt: current?.startedAt ?? new Date(),
              });
              armTimeout(studentId, labId);
              return row;
            }
          }
        }
        throw createErr;
      }

      try {
        if (lab.image.startsWith("jenkins/")) {
          // Jenkins cannot accept docker exec in this runtime. Seed its init
          // script before the image entrypoint starts instead.
          await injectJenkinsBootstrap(container);
        }
        await container.start();
        if (!lab.image.startsWith("jenkins/")) {
          // Service containers need extra time to boot their daemon before
          // setup can interact with them. Jenkins is excluded because its
          // runtime rejects docker exec; it is configured before start above.
          const setup = await runExec(container, [lab.shell ?? "sh", "-lc", lab.setupScript], {
            user: "root",
            timeoutMs: lab.useImageCmd ? SETUP_TIMEOUT_SERVICE : SETUP_TIMEOUT_MS,
          });
          if (setup.exitCode !== 0) {
            logger.error({ labId, studentId, output: setup.output }, "Lab setup script failed");
            throw new Error(`Setup script failed (exit ${setup.exitCode}): ${setup.output.slice(-500)}`);
          }
        }
        if (lab.image.startsWith("jenkins/")) {
          await waitForJenkinsReady(container);
          logger.info({ labId, studentId }, "Jenkins account initialization complete");
        }
      } catch (setupErr) {
        // Never leave a half-provisioned container running — remove it before surfacing the error.
        await container.remove({ force: true }).catch(() => undefined);
        throw setupErr;
      }
      const row = await upsertSessionRow(studentId, labId, {
        containerId: container.id,
        containerName: name,
        status: "running",
        errorMessage: null,
        startedAt: new Date(),
      });
      armTimeout(studentId, labId);
      return row;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return upsertSessionRow(studentId, labId, {
        status: "error",
        containerId: null,
        errorMessage: message,
        startedAt: null,
      });
    }
  } finally {
    if (!options.lockHeld) _startingKeys.delete(key);
  }
}

export async function stopSession(studentId: string, labId: string): Promise<void> {
  clearTimeout_(studentId, labId);
  const name = containerName(studentId, labId);
  const existing = await findExistingContainer(name);
  if (existing) {
    await existing.remove({ force: true }).catch(() => undefined);
  }
  await db
    .insert(labSessionsTable)
    .values({
      studentId,
      labId,
      status: "stopped",
      containerId: null,
      startedAt: null,
      totalTimeSeconds: 0,
    })
    .onConflictDoUpdate({
      target: [labSessionsTable.studentId, labSessionsTable.labId],
      set: {
        status: "stopped",
        containerId: null,
        startedAt: null,
        totalTimeSeconds: sql`
          ${labSessionsTable.totalTimeSeconds}
          + CASE
              WHEN ${labSessionsTable.startedAt} IS NULL THEN 0
              ELSE GREATEST(
                0,
                FLOOR(EXTRACT(EPOCH FROM (NOW() - ${labSessionsTable.startedAt})))
              )::int
            END
        `,
        updatedAt: new Date(),
      },
    });
}

/** Called by the cleanup job on startup to stop any sessions that survived a server restart
 *  and have been running longer than the 1-hour limit. */
export async function stopExpiredSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - CONTAINER_MAX_MS);
  const startingCutoff = new Date(Date.now() - STARTING_MAX_MS);
  const expired = await db
    .select({ studentId: labSessionsTable.studentId, labId: labSessionsTable.labId })
    .from(labSessionsTable)
    .where(or(
      and(eq(labSessionsTable.status, "running"), lt(labSessionsTable.startedAt, cutoff)),
      and(eq(labSessionsTable.status, "starting"), lt(labSessionsTable.updatedAt, startingCutoff)),
    ));
  let stopped = 0;
  for (const { studentId, labId } of expired) {
    logger.info({ studentId, labId }, "cleanup: stopping expired session");
    await stopSession(studentId, labId).then(() => { stopped += 1; }).catch(() => {});
  }
  return stopped;
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

  // Single atomic upsert — GREATEST ensures the best score never regresses
  // even when two verify requests race (eliminates the read-then-write hazard).
  await db
    .insert(labProgressTable)
    .values({ studentId, labId, status, bestScore: score, lastAttemptAt: now, lastResults: checks })
    .onConflictDoUpdate({
      target: [labProgressTable.studentId, labProgressTable.labId],
      set: {
        // Never regress a 'passed' status — once earned it stays earned
        status: sql`CASE WHEN ${labProgressTable.status} = 'passed' THEN 'passed' ELSE ${status} END`,
        bestScore: sql`GREATEST(${labProgressTable.bestScore}, EXCLUDED.best_score)`,
        lastAttemptAt: now,
        lastResults: checks,
        updatedAt: new Date(),
      },
    });
}

export { docker };
