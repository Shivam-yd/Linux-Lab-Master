import type { Server as HttpServer, IncomingMessage } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { Duplex } from "node:stream";
import { getLabByIdAsync } from "../lib/labs/registry";
import { getRunningContainer } from "../lib/docker/manager";
import { studentIdFromCookieHeader } from "../middleware/student";
import { logger } from "../lib/logger";

type ClientMessage =
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number };

// Binary framing protocol (avoids JSON parse/stringify on the hot output path):
//   0x01 <raw bytes>  — terminal output
//   0x02 <utf-8 json> — control/status message (low frequency)
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
  const studentId = studentIdFromCookieHeader(req.headers.cookie);

  if (!labId || !terminalName || !studentId) {
    sendJson(ws, { type: "status", message: "Missing labId, terminal, or student session." });
    ws.close();
    return;
  }

  const lab = await getLabByIdAsync(labId);
  const terminal = lab?.terminals.find((t) => t.name === terminalName);
  if (!lab || !terminal) {
    sendJson(ws, { type: "status", message: "Unknown lab or terminal." });
    ws.close();
    return;
  }

  const container = await getRunningContainer(studentId, labId);
  if (!container) {
    sendJson(ws, { type: "status", message: "Sandbox is not running. Start the session first." });
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
