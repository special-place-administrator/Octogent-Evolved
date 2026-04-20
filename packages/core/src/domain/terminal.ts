import type { AgentRuntimeState } from "./agentRuntime";

/**
 * Coarse lifecycle state of a terminal as seen by the coordinator.
 * - `live` — terminal process is running and the agent is active
 * - `idle` — terminal is running but the agent has no work in progress
 * - `queued` — terminal is pending creation or startup
 * - `blocked` — terminal is waiting on an external signal (permission, user input, dependency)
 */
export type AgentState = "live" | "idle" | "queued" | "blocked";

/**
 * How this tentacle's working directory is isolated.
 * - `shared` — works directly in the main repo working tree
 * - `worktree` — works in a dedicated `git worktree` so changes are isolated from the main tree
 */
export type TentacleWorkspaceMode = "shared" | "worktree";

export type TerminalSnapshot = {
  terminalId: string;
  label: string;
  state: AgentState;
  tentacleId: string;
  tentacleName?: string;
  workspaceMode?: TentacleWorkspaceMode;
  createdAt: string;
  /** True when the agent is currently waiting for the user to submit a prompt (idle-signal state). */
  hasUserPrompt?: boolean;
  /** ID of the terminal that spawned this one, if it was created by another agent rather than the operator. */
  parentTerminalId?: string;
  /** Fine-grained runtime state from the agent process; absent if the process hasn't reported yet. */
  agentRuntimeState?: AgentRuntimeState;
};
