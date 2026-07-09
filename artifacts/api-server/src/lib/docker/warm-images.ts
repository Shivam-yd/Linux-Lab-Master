import Docker from "dockerode";
import { LABS } from "../labs/registry";
import { logger } from "../logger";

/** Every image the lab registry currently depends on, de-duplicated. */
export function getRequiredImages(): string[] {
  return [...new Set(LABS.map((lab) => lab.image))];
}

async function imageExists(docker: Docker, image: string): Promise<boolean> {
  const list = await docker.listImages({ filters: { reference: [image] } });
  return list.length > 0;
}

function pullImage(docker: Docker, image: string): Promise<void> {
  return new Promise((resolve, reject) => {
    docker.pull(image, (err: Error | null, stream?: NodeJS.ReadableStream) => {
      if (err || !stream) return reject(err ?? new Error("docker.pull returned no stream"));
      docker.modem.followProgress(stream, (progressErr: Error | null) => {
        if (progressErr) return reject(progressErr);
        resolve();
      });
    });
  });
}

/**
 * Ensures every image referenced by the lab registry is present locally.
 * Runs at server startup so students hit an already-cached image instead of
 * a first-request pull (or a 404 if the environment has no outbound access
 * to the registry at request time). Never throws -- a missing image should
 * surface as a normal "start lab" error for that lab, not crash the server.
 */
export async function warmLabImages(docker: Docker): Promise<void> {
  const images = getRequiredImages();
  for (const image of images) {
    try {
      if (await imageExists(docker, image)) {
        logger.info({ image }, "Lab image already present");
        continue;
      }
      logger.info({ image }, "Pulling lab image");
      await pullImage(docker, image);
      logger.info({ image }, "Pulled lab image");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ image, message }, "Failed to warm lab image -- labs using it will fail to start until this is resolved");
    }
  }
}
