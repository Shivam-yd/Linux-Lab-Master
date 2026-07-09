import type { Server as HttpServer, IncomingMessage } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { Duplex } from "node:stream";
import { getLabById } from "../lib/labs/registry";
import { getRunningContainer } from "../lib/docker/manager";
import { studentIdFromCookieHeader } from "../middleware/student";
import { logger } from "../lib/logger";

type ClientMessage =
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number };

function sendJson(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
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

  const lab = getLabById(labId);
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

  sendJson(ws, { type: "status", message: `Connected to ${terminalName}.` });

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
      sendJson(ws, { type: "output", data: chunk.toString("utf8") });
    });
    stream.on("error", (err: Error) => {
      logger.warn({ err, labId, studentId, terminalName }, "Terminal exec stream error");
    });
    stream.on("end", () => {
      sendJson(ws, { type: "status", message: "Session ended." });
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
    sendJson(ws, { type: "status", message: "Failed to attach to the sandbox terminal." });
    ws.close();
  }
}
