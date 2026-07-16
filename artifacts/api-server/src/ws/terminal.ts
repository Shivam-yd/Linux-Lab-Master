import type { Server as HttpServer, IncomingMessage } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import type { Duplex } from "node:stream";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
import { getLabByIdAsync } from "../lib/labs/registry";
import { getRunningContainer } from "../lib/docker/manager";
import { logger } from "../lib/logger";

// ── Cookie helpers ─────────────────────────────────────────────────────────────

/** Parse a raw Cookie header into a name → raw-value map. */
function parseCookieHeader(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    try { out[key] = decodeURIComponent(val); } catch { out[key] = val; }
  }
  return out;
}

/**
 * Verify an express cookie-parser signed cookie value (format: `s:value.hmac`).
 * Returns the original value on success, null if the signature is invalid or
 * the format is unrecognised.
 */
function unsignCookie(raw: string, secret: string): string | null {
  if (!raw.startsWith("s:")) return null;
  const withoutPrefix = raw.slice(2);
  const dotIdx = withoutPrefix.lastIndexOf(".");
  if (dotIdx < 0) return null;
  const val = withoutPrefix.slice(0, dotIdx);
  const mac = withoutPrefix.slice(dotIdx + 1);
  // cookie-signature strips trailing '=' from the base64 MAC when signing,
  // so we must strip them from the expected value before comparing or
  // timingSafeEqual will always fail (the two buffers have different lengths).
  const expected = createHmac("sha256", secret).update(val).digest("base64").replace(/=+$/, "");
  try {
    // Use constant-time comparison to prevent timing attacks.
    const macBuf = Buffer.from(mac);
    const expBuf = Buffer.from(expected);
    if (macBuf.length !== expBuf.length) return null;
    return timingSafeEqual(macBuf, expBuf) ? val : null;
  } catch {
    return null;
  }
}

// ── Auth ───────────────────────────────────────────────────────────────────────

const GUEST_COOKIE = "_sid";

/**
 * Resolves a studentId from a WebSocket upgrade request using the same two-tier
 * strategy as the HTTP `requireAuth` middleware:
 *   1. Better Auth session cookie  →  authenticated user ID
 *   2. Signed guest `_sid` cookie  →  anonymous student ID
 *
 * Returns null only when neither credential is present or valid.
 */
async function studentIdFromUpgradeRequest(req: IncomingMessage): Promise<string | null> {
  // ── Tier 1: Better Auth authenticated session ──────────────────────────────
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (session?.user?.id) return session.user.id;
  } catch (err) {
    logger.warn({ err }, "terminal WS: Better Auth session check failed");
  }

  // ── Tier 2: Signed guest cookie (mirrors HTTP requireAuth) ─────────────────
  const cookieHeader = req.headers.cookie ?? "";
  if (cookieHeader) {
    const cookies = parseCookieHeader(cookieHeader);
    const raw = cookies[GUEST_COOKIE];
    if (raw) {
      const secret = process.env["SESSION_SECRET"] ?? "changeme-set-SESSION_SECRET-in-production";
      const guestId = unsignCookie(raw, secret);
      if (guestId) return guestId;
    }
  }

  return null;
}

// ── Binary framing protocol ────────────────────────────────────────────────────
// (avoids JSON parse/stringify on the hot output path):
//   0x01 <raw bytes>  — terminal output
//   0x02 <utf-8 json> — control/status message (low frequency)
type ClientMessage =
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number };

const MSG_OUTPUT  = 0x01;
const MSG_CONTROL = 0x02;

function sendOutput(ws: WebSocket, chunk: Buffer): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  const frame = Buffer.allocUnsafe(1 + chunk.length);
  frame[0] = MSG_OUTPUT;
  chunk.copy(frame, 1);
  ws.send(frame);
}

function sendControl(ws: WebSocket, payload: unknown): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  const json = Buffer.from(JSON.stringify(payload), "utf8");
  const frame = Buffer.allocUnsafe(1 + json.length);
  frame[0] = MSG_CONTROL;
  json.copy(frame, 1);
  ws.send(frame);
}

// ── WebSocket server ───────────────────────────────────────────────────────────

export function attachTerminalWebSocketServer(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket: Duplex, head) => {
    const url = new URL(req.url ?? "", "http://localhost");
    if (url.pathname !== "/api/ws/terminal") {
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, url);
    });
  });

  wss.on("connection", (ws: WebSocket, ...args: unknown[]) => {
    const req = args[0] as IncomingMessage;
    const url = args[1] as URL;
    void handleConnection(ws, req, url);
  });
}

async function handleConnection(ws: WebSocket, req: IncomingMessage, url: URL): Promise<void> {
  const labId = url.searchParams.get("labId");
  const terminalName = url.searchParams.get("terminal");
  const studentId = await studentIdFromUpgradeRequest(req);

  if (!labId || !terminalName || !studentId) {
    sendControl(ws, { type: "status", message: "Missing labId, terminal, or student session." });
    ws.close();
    return;
  }

  const lab = await getLabByIdAsync(labId);
  const terminal = lab?.terminals.find((t) => t.name === terminalName);
  if (!lab || !terminal) {
    sendControl(ws, { type: "status", message: "Unknown lab or terminal." });
    ws.close();
    return;
  }

  const container = await getRunningContainer(studentId, labId);
  if (!container) {
    sendControl(ws, { type: "status", message: "Sandbox is not running. Start the session first." });
    ws.close();
    return;
  }

  sendControl(ws, { type: "status", message: `Connected to ${terminalName}.` });

  try {
    const shell = lab.shell ?? "sh";
    const exec = await container.exec({
      Cmd: ["sh", "-lc", `cd ${JSON.stringify(terminal.cwd)} && exec ${shell} -l`],
      User: terminal.user,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Env: ["TERM=xterm-256color"],
    });
    const stream = await exec.start({ hijack: true, stdin: true, Tty: true });

    stream.on("data", (chunk: Buffer) => {
      sendOutput(ws, chunk);
    });
    stream.on("error", (err: Error) => {
      logger.warn({ err, labId, studentId, terminalName }, "Terminal exec stream error");
    });
    stream.on("end", () => {
      sendControl(ws, { type: "status", message: "Session ended." });
      ws.close();
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as ClientMessage;
        if (msg.type === "input") {
          stream.write(msg.data);
        } else if (msg.type === "resize") {
          exec.resize({ w: msg.cols, h: msg.rows }).catch(() => undefined);
        }
      } catch {
        // Ignore malformed frames.
      }
    });

    ws.on("close", () => {
      stream.destroy();
    });
    ws.on("error", () => {
      stream.destroy();
    });
  } catch (err) {
    logger.error({ err, labId, studentId, terminalName }, "Failed to attach terminal exec session");
    sendControl(ws, { type: "status", message: "Failed to attach to the sandbox terminal." });
    ws.close();
  }
}
