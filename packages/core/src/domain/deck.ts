/**
 * High-level operational status of a tentacle shown on the deck.
 * - `idle` — no active terminal or work in progress
 * - `active` — at least one terminal is live and processing
 * - `blocked` — agent is waiting on user permission or an unresolved dependency
 * - `needs-review` — work is complete but the operator hasn't reviewed the output yet
 */
export type DeckTentacleStatus = "idle" | "active" | "blocked" | "needs-review";

export type DeckOctopusAppearance = {
  animation: string | null;
  /** Valid: "normal" | "happy" | "angry" | "surprised". "sleepy" is reserved for idle state — never assign on creation. */
  expression: string | null;
  accessory: string | null;
  hairColor: string | null;
};

export type DeckAvailableSkill = {
  name: string;
  description: string;
  /** Whether the skill comes from the project's `.claude/` directory or the user's global `~/.claude/` directory. */
  source: "project" | "user";
};

export type DeckTentacleSummary = {
  tentacleId: string;
  displayName: string;
  description: string;
  status: DeckTentacleStatus;
  color: string | null;
  octopus: DeckOctopusAppearance;
  scope: {
    /** Filesystem paths this tentacle is responsible for (used for context loading and file scoping). */
    paths: string[];
    /** Obsidian vault tags associated with this tentacle for vault note discovery. */
    tags: string[];
  };
  /** Obsidian vault file paths linked to this tentacle for context. */
  vaultFiles: string[];
  todoTotal: number;
  todoDone: number;
  todoItems: { text: string; done: boolean }[];
  /** Skill names the system recommends activating for this tentacle based on its context. */
  suggestedSkills: string[];
};
