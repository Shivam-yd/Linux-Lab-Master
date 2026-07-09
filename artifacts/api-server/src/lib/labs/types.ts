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
  /** Interactive login shell available in the image (e.g. "bash" or "sh"). Defaults to "sh" if omitted. */
  shell?: string;
  terminals: LabTerminal[];
  /** Bash run as root immediately after the container starts, to seed the lab's starting state. */
  setupScript: string;
  /**
   * Bash run as root to grade the lab. Must print one line per check:
   * CHECK:<taskId>:<PASS|FAIL>:<message>
   */
  verifyScript: string;
  /**
   * Progressive hints revealed one at a time when the student is stuck.
   * Each string is a short markdown hint shown in order.
   */
  hints?: string[];
}
