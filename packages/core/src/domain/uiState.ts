import type { TerminalCompletionSoundId } from "./completionSound";

/** UI preferences persisted across sessions (stored in the API, keyed by user). */
export type PersistedUiState = {
  /** Index of the currently selected primary navigation tab. */
  activePrimaryNav?: number;
  isAgentsSidebarVisible?: boolean;
  sidebarWidth?: number;
  /** Whether the "Active Agents" collapsible section in the sidebar is open. */
  isActiveAgentsSectionExpanded?: boolean;
  /** Whether the runtime status strip at the top of the UI is shown. */
  isRuntimeStatusStripVisible?: boolean;
  isMonitorVisible?: boolean;
  /** Whether the bottom telemetry / usage bar is visible. */
  isBottomTelemetryVisible?: boolean;
  isCodexUsageVisible?: boolean;
  isClaudeUsageVisible?: boolean;
  isClaudeUsageSectionExpanded?: boolean;
  isCodexUsageSectionExpanded?: boolean;
  terminalCompletionSound?: TerminalCompletionSoundId;
  /** Terminal IDs whose panels are collapsed to a title bar. */
  minimizedTerminalIds?: string[];
  /** Per-terminal panel widths in pixels, keyed by terminalId. */
  terminalWidths?: Record<string, number>;
  /** Terminal IDs currently pinned open in the canvas view. */
  canvasOpenTerminalIds?: string[];
  /** Tentacle IDs currently pinned open in the canvas view. */
  canvasOpenTentacleIds?: string[];
  /** Width of the terminals panel within the canvas layout, in pixels. */
  canvasTerminalsPanelWidth?: number;
  /** Milliseconds of no output after which a terminal is considered inactive and dimmed. */
  terminalInactivityThresholdMs?: number;
};
