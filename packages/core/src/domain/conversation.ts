export type ConversationTurn = {
  turnId: string;
  role: "user" | "assistant";
  content: string;
  startedAt: string;
  endedAt: string;
};

/**
 * A low-level event recorded in the conversation transcript stream.
 * - `session_start` / `session_end` — session lifecycle boundaries
 * - `input_submit` — user submitted a prompt
 * - `output_chunk` — a partial assistant response streamed to the UI
 * - `state_change` — agent runtime state transitioned (e.g. idle → processing)
 */
export type ConversationTranscriptEvent = {
  eventId: string;
  sessionId: string;
  tentacleId: string;
  timestamp: string;
  type: "session_start" | "input_submit" | "output_chunk" | "state_change" | "session_end";
};

export type ConversationSessionSummary = {
  sessionId: string;
  tentacleId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  lastEventAt: string | null;
  eventCount: number;
  turnCount: number;
  userTurnCount: number;
  assistantTurnCount: number;
  /** Truncated text of the first user message in this session, for list previews. */
  firstUserTurnPreview: string | null;
  /** Truncated text of the most recent user message, for list previews. */
  lastUserTurnPreview: string | null;
  /** Truncated text of the most recent assistant message, for list previews. */
  lastAssistantTurnPreview: string | null;
};

export type ConversationSessionDetail = ConversationSessionSummary & {
  turns: ConversationTurn[];
  events: ConversationTranscriptEvent[];
};

export type ConversationSearchHit = {
  sessionId: string;
  turnId: string;
  role: "user" | "assistant";
  snippet: string;
  turnStartedAt: string;
};

export type ConversationSearchResult = {
  query: string;
  hits: ConversationSearchHit[];
};
