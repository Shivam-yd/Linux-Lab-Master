import { createServer } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { attachTerminalWebSocketServer } from "./ws/terminal";
import { docker } from "./lib/docker/manager";
import { warmLabImages } from "./lib/docker/warm-images";

const rawPort = process.env["PORT"] ?? "8080";
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

// Start polling GitHub for new/updated lab definitions every hour.
// Also runs once 5 s after startup so remote labs appear quickly.
import { startBackgroundSync } from "./lib/github-sync";
startBackgroundSync();

// Periodic cleanup: stale guest data, expired auth rows, old sync logs,
// and containers that survived a restart past their 1-hour limit.
import { startCleanupJob } from "./lib/cleanup";
startCleanupJob();
