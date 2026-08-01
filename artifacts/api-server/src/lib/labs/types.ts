export interface LabTerminal {
  /** Name shown to the student and used in the ?terminal= query param. */
  name: string;
  /** OS user the exec session logs in as. */
  user: string;
  /** Working directory for the exec session. */
  cwd: string;
}

export interface LabDefinition {
  id: string;
  title: string;
  /** Technology track this lab belongs to (e.g. "linux", "terraform"). Used for sidebar grouping. */
  track: string;
  /** Skill level tier within the track (1 = foundation, 2 = intermediate, 3 = advanced). */
  level: number;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  summary: string;
  estimatedMinutes: number;
  order: number;
  objectives: string[];
  instructions: string;
  tasks: { id: string; description: string }[];
  /** Docker image to run the sandbox in. Must already be pulled/pullable without extra setup. */
  image: string;
  /**
   * Override the image's default ENTRYPOINT. Required for images whose entrypoint is a CLI binary
   * (e.g. hashicorp/terraform sets ENTRYPOINT ["/bin/terraform"]) so that the container keeps
   * running via `sleep infinity` instead of exiting immediately.
   */
  entrypoint?: string[];
  /**
   * When true, the container starts using the image's own Entrypoint+Cmd (e.g. a service image
   * like jenkins/jenkins that starts a long-running daemon). The manager will NOT inject
   * `sleep infinity` as the command.
   */
  useImageCmd?: boolean;
  /** Additional environment variables injected into the container. */
  env?: string[];
  /** Interactive login shell available in the image (e.g. "bash" or "sh"). Defaults to "sh" if omitted. */
  shell?: string;
  terminals: LabTerminal[];
  /**
   * Container TCP ports to publish on the host (random host port assigned by Docker).
   * Enables the /api/labs/:labId/ui proxy for service-based labs (e.g. Jenkins).
   * The first port is exposed as `uiPort` in the lab detail API response.
   */
  ports?: number[];
  /** URL path suffix appended when embedding the UI in the workspace iframe (e.g. "/jenkins/"). */
  uiPath?: string;
  /** Bash run as root immediately after the container starts, to seed the lab's starting state. */
  setupScript: string;
  /**
   * Bash run as root to grade the lab. Must print one line per check:
   * CHECK:<taskId>:<PASS|FAIL>:<message>
   */
  verifyScript: string;
  /**
   * When true, the sandbox container is started with Privileged: true.
   * Required for Docker-in-Docker labs that run a real dockerd inside the sandbox.
   */
  privileged?: boolean;
  hints?: string[];
}
