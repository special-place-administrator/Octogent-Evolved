import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { logVerbose } from "../logging";
import { parseClaudeTranscript } from "./claudeTranscript";
import { storeClaudeTranscriptTurns } from "./conversations";
import { broadcastMessage } from "./protocol";
import type { PersistedTerminal, TerminalSession } from "./types";

const MAX_AUTO_NAME_LENGTH = 50;

const deriveTerminalNameFromPrompt = (prompt: string): string => {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_AUTO_NAME_LENGTH) {
    return normalized;
  }

  // Truncate at the last space before the limit to avoid cutting mid-word.
  const truncated = normalized.slice(0, MAX_AUTO_NAME_LENGTH);
  const lastSpace = truncated.lastIndexOf(" ");
  return lastSpace > 0 ? `${truncated.slice(0, lastSpace)}…` : `${truncated}…`;
};

export const createHookProcessor = (deps: {
  terminals: Map<string, PersistedTerminal>;
  sessions: Map<string, TerminalSession>;
  transcriptDirectoryPath: string;
  getApiBaseUrl: () => string;
  persistRegistry: () => void;
  deliverChannelMessages: (terminalId: string) => void;
  onStateChange?: (
    terminalId: string,
    state: TerminalSession["agentState"],
    toolName?: string,
  ) => void;
}) => {
  const {
    terminals,
    sessions,
    transcriptDirectoryPath,
    getApiBaseUrl,
    persistRegistry,
    deliverChannelMessages,
    onStateChange,
  } = deps;

  const parseSettingsObject = (fileContents: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(fileContents) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
      }
      return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  // Identify hook entries we installed ourselves, so re-running install
  // with a different API base URL replaces them instead of duplicating
  // them. We fingerprint on the octogent API paths that appear in every
  // hook we emit; a user's own hook that happens to mention those paths
  // is extraordinarily unlikely, and even then the cost is that the
  // user's hook gets replaced on next install — a merge, not a data loss.
  const OCTOGENT_HOOK_FINGERPRINTS = [
    "/api/hooks/",
    "/api/code-intel/events",
  ];

  const isOctogentOwnedHookEntry = (entry: unknown): boolean => {
    const serialized = JSON.stringify(entry);
    return OCTOGENT_HOOK_FINGERPRINTS.some((fp) => serialized.includes(fp));
  };

  const mergeHookEntries = (
    existingValue: unknown,
    eventName: string,
    nextEntries: unknown[],
  ): Record<string, unknown> => {
    const nextHooks =
      existingValue && typeof existingValue === "object" && !Array.isArray(existingValue)
        ? { ...(existingValue as Record<string, unknown>) }
        : {};
    const existingEntries = Array.isArray(nextHooks[eventName])
      ? [...(nextHooks[eventName] as unknown[])]
      : [];

    // Strip any previously-installed octogent entries so we can re-install
    // with the current URL. User-authored entries (not fingerprinted as
    // octogent-owned) are preserved as-is.
    const preservedUserEntries = existingEntries.filter(
      (entry) => !isOctogentOwnedHookEntry(entry),
    );
    const mergedEntries = [...preservedUserEntries];

    for (const nextEntry of nextEntries) {
      const serializedNextEntry = JSON.stringify(nextEntry);
      const alreadyPresent = preservedUserEntries.some(
        (existingEntry) => JSON.stringify(existingEntry) === serializedNextEntry,
      );
      if (!alreadyPresent) {
        mergedEntries.push(nextEntry);
      }
    }

    nextHooks[eventName] = mergedEntries;
    return nextHooks;
  };

  const installHooksInDirectory = (targetCwd: string) => {
    const targetClaudeDir = join(targetCwd, ".claude");
    const targetSettingsPath = join(targetClaudeDir, "settings.json");
    const apiBaseUrl = getApiBaseUrl();

    const hooksConfig = {
      hooks: {
        SessionStart: [
          {
            matcher: "*",
            hooks: [
              {
                type: "command",
                command: `curl -s -X POST "${apiBaseUrl}/api/hooks/session-start?octogent_session=$OCTOGENT_SESSION_ID" -H 'Content-Type: application/json' -d @- || true`,
                timeout: 5,
              },
            ],
          },
        ],
        UserPromptSubmit: [
          {
            matcher: "*",
            hooks: [
              {
                type: "command",
                command: `curl -s -X POST "${apiBaseUrl}/api/hooks/user-prompt-submit?octogent_session=$OCTOGENT_SESSION_ID" -H 'Content-Type: application/json' -d @- || true`,
                timeout: 5,
              },
            ],
          },
        ],
        PreToolUse: [
          {
            matcher: "*",
            hooks: [
              {
                type: "command",
                command: `curl -s -X POST "${apiBaseUrl}/api/hooks/pre-tool-use" -H 'Content-Type: application/json' -H "X-Octogent-Session: $OCTOGENT_SESSION_ID" -d @- || true`,
                timeout: 5,
              },
            ],
          },
        ],
        PostToolUse: [
          {
            matcher: "Edit|Write",
            hooks: [
              {
                type: "command",
                command: `curl -s -X POST "${apiBaseUrl}/api/code-intel/events" -H 'Content-Type: application/json' -H "X-Octogent-Session: $OCTOGENT_SESSION_ID" -d @- || true`,
                timeout: 5,
              },
            ],
          },
        ],
        Notification: [
          {
            matcher: "*",
            hooks: [
              {
                type: "command",
                command: `curl -s -X POST "${apiBaseUrl}/api/hooks/notification" -H 'Content-Type: application/json' -H "X-Octogent-Session: $OCTOGENT_SESSION_ID" -d @- || true`,
                timeout: 5,
              },
            ],
          },
        ],
        Stop: [
          {
            matcher: "*",
            hooks: [
              {
                type: "command",
                command: `curl -s -X POST "${apiBaseUrl}/api/hooks/stop?octogent_session=$OCTOGENT_SESSION_ID" -H 'Content-Type: application/json' -d @- || true`,
                timeout: 15,
              },
            ],
          },
        ],
      },
    };

    try {
      mkdirSync(targetClaudeDir, { recursive: true });
      const existingSettings = existsSync(targetSettingsPath)
        ? parseSettingsObject(readFileSync(targetSettingsPath, "utf8"))
        : null;
      const mergedSettings =
        existingSettings && typeof existingSettings === "object" ? { ...existingSettings } : {};

      let mergedHooks =
        mergedSettings.hooks &&
        typeof mergedSettings.hooks === "object" &&
        !Array.isArray(mergedSettings.hooks)
          ? { ...(mergedSettings.hooks as Record<string, unknown>) }
          : {};

      for (const [eventName, eventEntries] of Object.entries(hooksConfig.hooks)) {
        mergedHooks = mergeHookEntries(mergedHooks, eventName, eventEntries);
      }

      mergedSettings.hooks = mergedHooks;
      writeFileSync(targetSettingsPath, `${JSON.stringify(mergedSettings, null, 2)}\n`, "utf8");
    } catch {
      // Best-effort
    }
  };

  // TOCTOU buffer: `installHooksInDirectory` writes `.claude/settings.json`
  // before `sessionRuntime.startSession` puts the session in the map.
  // Under heavy concurrent spawns, Claude Code on a fast machine *could*
  // fire a hook before the session exists in `sessions`. Without this
  // buffer, `handleHook` silently no-ops and the bootstrap state machine
  // waits forever. We hold events for up to 10s and replay on session
  // registration. Buffered hook types are limited to bootstrap signals
  // (`session-start`, `notification`, `user-prompt-submit`) — other hooks
  // are advisory and safe to drop.
  const PENDING_HOOK_TTL_MS = 10_000;
  // Only hooks that the bootstrap state machine gates on get buffered.
  // `user-prompt-submit` is intentionally NOT buffered: its primary side
  // effect is auto-rename, which operates on the terminal record (not the
  // session), so it already works correctly when the session hasn't been
  // registered yet. For the bootstrap state machine's submit-confirmation
  // path, the session is guaranteed to exist by the time we write `\r` —
  // the state machine itself runs after `sessions.set`.
  const BUFFERABLE_HOOK_NAMES = new Set(["session-start", "notification"]);
  type PendingHookEvent = {
    hookName: string;
    payload: unknown;
    receivedAt: number;
  };
  const pendingHookEvents = new Map<string, PendingHookEvent[]>();

  const prunePendingEvents = () => {
    const now = Date.now();
    for (const [sid, events] of pendingHookEvents.entries()) {
      const fresh = events.filter((e) => now - e.receivedAt < PENDING_HOOK_TTL_MS);
      if (fresh.length === 0) {
        pendingHookEvents.delete(sid);
      } else if (fresh.length !== events.length) {
        pendingHookEvents.set(sid, fresh);
      }
    }
  };

  const handleHook = (
    hookName: string,
    payload: unknown,
    octogentSessionId?: string,
  ): { ok: boolean } => {
    logVerbose(
      `[Hook] Received hook: ${hookName} octogentSession=${octogentSessionId ?? "(none)"}`,
    );

    if (!payload || typeof payload !== "object") {
      return { ok: true };
    }

    const hookPayloadRecord = payload as Record<string, unknown>;

    // If this is a bootstrap-signalling hook and the session hasn't been
    // registered in the sessions map yet, buffer it. The queue drains
    // when the session lands in `sessions` via `drainPendingHookEvents`.
    // This catches the TOCTOU window between `installHooksInDirectory`
    // (during createTerminal) and `sessions.set` (during startSession).
    // A fast claude boot under concurrent-spawn load can fire the hook
    // inside that window; without buffering, the signal is lost and the
    // bootstrap state machine waits forever for an idle_prompt that
    // already fired.
    if (
      octogentSessionId &&
      BUFFERABLE_HOOK_NAMES.has(hookName) &&
      !sessions.has(octogentSessionId)
    ) {
      prunePendingEvents();
      const queue = pendingHookEvents.get(octogentSessionId) ?? [];
      queue.push({ hookName, payload, receivedAt: Date.now() });
      pendingHookEvents.set(octogentSessionId, queue);
      logVerbose(
        `[Hook] Buffered ${hookName} for unknown session ${octogentSessionId} (size=${queue.length})`,
      );
      return { ok: true };
    }

    if (hookName === "session-start") {
      if (!octogentSessionId) {
        return { ok: true };
      }
      const session = sessions.get(octogentSessionId);
      if (session) {
        session.sessionStartAt = Date.now();
      }
      return { ok: true };
    }

    if (hookName === "notification") {
      if (!octogentSessionId) {
        return { ok: true };
      }
      const session = sessions.get(octogentSessionId);
      if (!session) {
        logVerbose(`[Hook] notification: no session for ${octogentSessionId}, skipping.`);
        return { ok: true };
      }

      const notificationType =
        typeof hookPayloadRecord.notification_type === "string"
          ? hookPayloadRecord.notification_type
          : null;

      logVerbose(`[Hook] notification: type=${notificationType} session=${octogentSessionId}`);

      if (notificationType === "permission_prompt") {
        session.agentState = "waiting_for_permission";
        session.stateTracker.forceState("waiting_for_permission");
        onStateChange?.(octogentSessionId, "waiting_for_permission", session.lastToolName);
        broadcastMessage(session, {
          type: "state",
          state: "waiting_for_permission",
          ...(session.lastToolName ? { toolName: session.lastToolName } : {}),
        });
      } else if (notificationType === "idle_prompt") {
        // Bump the idle-prompt counter so the bootstrap state machine can
        // detect "claude TUI is sitting at input" transitions. Every bump
        // represents one fresh-from-idle moment: first boot, recovery from
        // a slash command, or — critically — recovery after our injected
        // paste was consumed without a submit (the eaten-Enter case).
        session.idlePromptCount = (session.idlePromptCount ?? 0) + 1;

        // Deliberately do NOT force agentState to "idle" here. Claude Code
        // fires `idle_prompt` more generously than "user has been idle for
        // a while" — it fires between tool calls, after paste rendering,
        // and at other short TUI-idle moments during active processing.
        // Using it as the authoritative "return to idle" signal flipped
        // the UI badge to IDLE while the agent was still visibly thinking
        // or invoking tools. `Stop` is the correct one-per-turn signal
        // for that transition; see the Stop hook handler below.

        // Still deliver any queued channel messages now that the agent
        // has reached an input-ready moment — channel-message delivery is
        // idempotent and firing it on either idle_prompt or Stop is safe.
        deliverChannelMessages(octogentSessionId);
      }

      return { ok: true };
    }

    if (hookName === "pre-tool-use") {
      if (!octogentSessionId) {
        return { ok: true };
      }
      const session = sessions.get(octogentSessionId);
      if (!session) {
        return { ok: true };
      }

      const toolName =
        typeof hookPayloadRecord.tool_name === "string" ? hookPayloadRecord.tool_name : null;

      logVerbose(`[Hook] pre-tool-use: tool=${toolName} session=${octogentSessionId}`);

      if (toolName) {
        session.lastToolName = toolName;
      }

      if (toolName === "AskUserQuestion") {
        session.agentState = "waiting_for_user";
        session.stateTracker.forceState("waiting_for_user");
        onStateChange?.(octogentSessionId, "waiting_for_user");
        broadcastMessage(session, { type: "state", state: "waiting_for_user" });
      }

      return { ok: true };
    }

    if (hookName === "user-prompt-submit") {
      if (!octogentSessionId) {
        return { ok: true };
      }

      const terminal = terminals.get(octogentSessionId);
      if (!terminal) {
        return { ok: true };
      }

      // Update last-active timestamp (determines active/inactive on the canvas).
      terminal.lastActiveAt = new Date().toISOString();

      // The user submitted a prompt, so the agent is about to start processing.
      // Transition state out of waiting/idle to processing immediately.
      const activitySession = sessions.get(terminal.terminalId);
      if (activitySession) {
        activitySession.agentState = "processing";
        activitySession.lastToolName = undefined;
        activitySession.stateTracker.forceState("processing");
        onStateChange?.(terminal.terminalId, "processing");
        broadcastMessage(activitySession, { type: "state", state: "processing" });
        broadcastMessage(activitySession, { type: "activity" });

        // Bump the submit counter so the bootstrap state machine can
        // confirm "claude actually received our injected prompt" — the
        // unambiguous success signal that our bracketed-paste + Enter
        // landed, not a staged-but-unsubmitted buffer.
        activitySession.userPromptSubmitCount =
          (activitySession.userPromptSubmitCount ?? 0) + 1;
      }

      // Auto-name the terminal from the first prompt when it still has its default name.
      if (terminal.nameOrigin === "generated") {
        const prompt =
          typeof hookPayloadRecord.prompt === "string" ? hookPayloadRecord.prompt.trim() : "";
        const renameContext = terminal.autoRenamePromptContext?.trim() || prompt;
        if (renameContext.length > 0) {
          const derived = deriveTerminalNameFromPrompt(renameContext);
          terminal.tentacleName = derived;
          terminal.nameOrigin = "prompt";
          terminal.autoRenamePromptContext = undefined;
          logVerbose(`[Hook] Auto-named terminal ${terminal.terminalId} → "${derived}"`);

          const session = sessions.get(terminal.terminalId);
          if (session) {
            broadcastMessage(session, { type: "rename", tentacleName: derived });
          }
        }
      }

      persistRegistry();
      return { ok: true };
    }

    if (hookName !== "stop") {
      return { ok: true };
    }

    // Stop fires once per agent turn — this is the authoritative "claude
    // finished responding, back to idle" signal. Do the state flip BEFORE
    // the transcript-path guards below so state recovers even on payload
    // shape anomalies. Skipped only if session doesn't exist (no PTY to
    // broadcast to).
    if (octogentSessionId) {
      const stopSession = sessions.get(octogentSessionId);
      if (stopSession) {
        stopSession.agentState = "idle";
        stopSession.lastToolName = undefined;
        stopSession.stateTracker.forceState("idle");
        onStateChange?.(octogentSessionId, "idle");
        broadcastMessage(stopSession, { type: "state", state: "idle" });
      }
    }

    const hookPayload = payload as Record<string, unknown>;
    const transcriptPath =
      typeof hookPayload.transcript_path === "string" ? hookPayload.transcript_path : null;
    const hookCwd = typeof hookPayload.cwd === "string" ? hookPayload.cwd : null;

    logVerbose(`[Hook] Stop hook: transcriptPath=${transcriptPath}, hookCwd=${hookCwd}`);

    if (!transcriptPath || !hookCwd) {
      logVerbose("[Hook] Missing transcriptPath or hookCwd, skipping.");
      return { ok: true };
    }

    let matchedSessionId: string | null = null;

    if (octogentSessionId && sessions.has(octogentSessionId)) {
      matchedSessionId = octogentSessionId;
      logVerbose(`[Hook] Matched session by octogent_session param: ${matchedSessionId}`);
    } else if (octogentSessionId) {
      logVerbose(
        `[Hook] octogent_session=${octogentSessionId} not found in active sessions, skipping.`,
      );
      return { ok: true };
    } else {
      logVerbose("[Hook] No octogent_session param — ignoring hook from external Claude session.");
      return { ok: true };
    }

    logVerbose(`[Hook] Matched session: ${matchedSessionId}, parsing transcript...`);
    const turns = parseClaudeTranscript(transcriptPath);
    logVerbose(`[Hook] Parsed ${turns?.length ?? 0} turns from transcript.`);

    const lastAssistantMessage =
      typeof hookPayload.last_assistant_message === "string"
        ? hookPayload.last_assistant_message.trim()
        : null;

    if (lastAssistantMessage && lastAssistantMessage.length > 0) {
      const effectiveTurns = turns ?? [];
      const lastTurn = effectiveTurns.length > 0 ? effectiveTurns[effectiveTurns.length - 1] : null;

      if (!lastTurn || lastTurn.role !== "assistant" || lastTurn.content !== lastAssistantMessage) {
        const now = new Date().toISOString();
        effectiveTurns.push({
          turnId: `turn-${effectiveTurns.length + 1}`,
          role: "assistant",
          content: lastAssistantMessage,
          startedAt: now,
          endedAt: now,
        });
        logVerbose("[Hook] Appended last_assistant_message as final turn.");
      }

      if (effectiveTurns.length > 0) {
        storeClaudeTranscriptTurns(transcriptDirectoryPath, matchedSessionId, effectiveTurns);
        logVerbose(`[Hook] Stored ${effectiveTurns.length} turns for session ${matchedSessionId}.`);
      }
    } else if (turns && turns.length > 0) {
      storeClaudeTranscriptTurns(transcriptDirectoryPath, matchedSessionId, turns);
      logVerbose(`[Hook] Stored ${turns.length} turns for session ${matchedSessionId}.`);
    }

    // Deliver any queued channel messages now that the agent is idle.
    if (matchedSessionId) {
      deliverChannelMessages(matchedSessionId);
    }

    return { ok: true };
  };

  // Invoked by sessionRuntime the moment a session is inserted into the
  // `sessions` map. Replays any hook events that arrived between the hook
  // install (during createTerminal) and the PTY spawn (during startSession).
  const drainPendingHookEvents = (octogentSessionId: string) => {
    const queue = pendingHookEvents.get(octogentSessionId);
    if (!queue || queue.length === 0) {
      return;
    }
    pendingHookEvents.delete(octogentSessionId);
    logVerbose(
      `[Hook] Draining ${queue.length} buffered event(s) for session ${octogentSessionId}`,
    );
    for (const event of queue) {
      handleHook(event.hookName, event.payload, octogentSessionId);
    }
  };

  return { handleHook, installHooksInDirectory, drainPendingHookEvents };
};
