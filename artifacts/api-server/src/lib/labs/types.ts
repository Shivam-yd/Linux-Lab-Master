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
}
