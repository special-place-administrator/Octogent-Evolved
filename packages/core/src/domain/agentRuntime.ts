/**
 * Fine-grained runtime state reported by the agent process itself.
 * - `idle` — agent loop is running but has no active work
 * - `processing` — agent is actively computing a response or running tools
 * - `waiting_for_permission` — agent paused; a tool call requires user approval
 * - `waiting_for_user` — agent emitted a question and is waiting for human input
 */
export type AgentRuntimeState =
  | "idle"
  | "processing"
  | "waiting_for_permission"
  | "waiting_for_user";

export const isAgentRuntimeState = (value: unknown): value is AgentRuntimeState =>
  value === "idle" ||
  value === "processing" ||
  value === "waiting_for_permission" ||
  value === "waiting_for_user";

export type TerminalAgentProvider = "codex" | "claude-code";

export const TERMINAL_AGENT_PROVIDERS: TerminalAgentProvider[] = ["codex", "claude-code"];

export const isTerminalAgentProvider = (value: unknown): value is TerminalAgentProvider =>
  typeof value === "string" && (TERMINAL_AGENT_PROVIDERS as readonly string[]).includes(value);
