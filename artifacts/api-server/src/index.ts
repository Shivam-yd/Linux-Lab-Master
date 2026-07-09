import { createServer } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { attachTerminalWebSocketServer } from "./ws/terminal";
import { docker } from "./lib/docker/manager";
import { warmLabImages } from "./lib/docker/warm-images";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = createServer(app);
attachTerminalWebSocketServer(server);

server.listen(port, () => {
  logger.info({ port }, "Server listening");
});

// Warm the Docker image cache in the background so lab starts hit an
// already-pulled image instead of racing a first-time pull (or failing
// outright if this environment has no outbound registry access at
// request time). Runs after listen() so the health check isn't blocked
// on image pulls.
void warmLabImages(docker);
