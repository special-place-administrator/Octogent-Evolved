import { type WriteStream, createWriteStream, existsSync, mkdirSync } from "node:fs";
import type { IncomingMessage } from "node:http";
import { join } from "node:path";
import type { Duplex } from "node:stream";

import { type IPty, spawn } from "node-pty";
import type { WebSocket, WebSocketServer } from "ws";

import { type AgentRuntimeState, AgentStateTracker } from "../agentStateDetection";
import {
  DEFAULT_AGENT_PROVIDER,
  TERMINAL_BOOTSTRAP_COMMANDS,
  TERMINAL_SCROLLBACK_MAX_BYTES,
  TERMINAL_SESSION_IDLE_GRACE_MS,
} from "./constants";
import {
  type ConversationTranscriptEvent,
  type ConversationTranscriptEventPayload,
  ensureTranscriptDirectory,
  transcriptFilenameForSession,
} from "./conversations";
import { broadcastMessage, getTerminalId, sendMessage } from "./protocol";
import { createShellEnvironment, ensureNodePtySpawnHelperExecutable } from "./ptyEnvironment";
import { toErrorMessage } from "./systemClients";
import type { DirectSessionListener, PersistedTerminal, TerminalSession } from "./types";

type CreateSessionRuntimeOptions = {
  websocketServer: WebSocketServer;
  terminals: Map<string, PersistedTerminal>;
  sessions: Map<string, TerminalSession>;
  resolveTerminalSession?: (terminalId: string) => {
    sessionId: string;
    tentacleId: string;
  } | null;
  getTentacleWorkspaceCwd: (tentacleId: string) => string;
  getApiBaseUrl?: () => string;
  isDebugPtyLogsEnabled: boolean;
  ptyLogDir: string;
  transcriptDirectoryPath: string;
  sessionIdleGraceMs?: number;
  scrollbackMaxBytes?: number;
  onStateChange?: (terminalId: string, state: AgentRuntimeState, toolName?: string) => void;
  // Called immediately after a new session is inserted into the sessions
  // map. Used by the hook processor to drain any buffered hook events
  // that arrived between `installHooksInDirectory` and `sessions.set`.
  onSessionRegistered?: (sessionId: string) => void;
};

const ANSI_BEL = String.fromCharCode(0x07);
const ANSI_ESCAPE = String.fromCharCode(0x1b);
const BROKEN_OSC_TAIL_RE = new RegExp(
  `^\\][^${ANSI_BEL}${ANSI_ESCAPE}]*(?:${ANSI_BEL}|${ANSI_ESCAPE}\\\\)`,
);

export const createSessionRuntime = ({
  websocketServer,
  terminals,
  sessions,
  resolveTerminalSession,
  getTentacleWorkspaceCwd,
  getApiBaseUrl,
  isDebugPtyLogsEnabled,
  ptyLogDir,
  transcriptDirectoryPath,
  sessionIdleGraceMs = TERMINAL_SESSION_IDLE_GRACE_MS,
  scrollbackMaxBytes = TERMINAL_SCROLLBACK_MAX_BYTES,
  onStateChange,
  onSessionRegistered,
}: CreateSessionRuntimeOptions) => {
  const DEFAULT_PTY_COLS = 120;
  const DEFAULT_PTY_ROWS = 35;

  const getShellLaunch = () => {
    if (process.platform === "win32") {
      return {
        command: process.env.ComSpec ?? "cmd.exe",
        args: [],
      };
    }

    const shellFromEnvironment = process.env.SHELL?.trim();
    if (shellFromEnvironment && shellFromEnvironment.length > 0) {
      return {
        command: shellFromEnvironment,
        args: ["-i"],
      };
    }

    return {
      command: "/bin/bash",
      args: ["-i"],
    };
  };

  const createDebugLog = (sessionId: string) => {
    if (!isDebugPtyLogsEnabled) {
      return undefined;
    }

    mkdirSync(ptyLogDir, { recursive: true });
    const filename = `${sessionId}-${Date.now()}.log`;
    return createWriteStream(join(ptyLogDir, filename), {
      flags: "a",
      encoding: "utf8",
    });
  };

  const appendDebugLog = (session: TerminalSession, line: string) => {
    session.debugLog?.write(`${new Date().toISOString()} ${line}\n`);
  };

  const createTranscriptLog = (sessionId: string) => {
    ensureTranscriptDirectory(transcriptDirectoryPath);
    const filename = transcriptFilenameForSession(sessionId);
    const stream = createWriteStream(join(transcriptDirectoryPath, filename), {
      flags: "a",
      encoding: "utf8",
    });
    stream.on("error", () => {
      // Keep terminal flow alive even if transcript writes fail.
    });
    return stream;
  };

  const appendTranscriptEvent = (
    session: TerminalSession,
    sessionId: string,
    event: ConversationTranscriptEventPayload,
  ) => {
    if (!session.transcriptLog) {
      return;
    }

    const nextEventCount = (session.transcriptEventCount ?? 0) + 1;
    session.transcriptEventCount = nextEventCount;
    const payload: ConversationTranscriptEvent = {
      ...event,
      eventId: `${sessionId}:${nextEventCount}`,
      sessionId,
      tentacleId: session.tentacleId,
    } as ConversationTranscriptEvent;
    session.transcriptLog.write(`${JSON.stringify(payload)}\n`);
  };

  const closeTranscript = (
    session: TerminalSession,
    sessionId: string,
    event: ConversationTranscriptEventPayload,
  ) => {
    if (session.hasTranscriptEnded) {
      return;
    }

    appendTranscriptEvent(session, sessionId, event);
    session.hasTranscriptEnded = true;
    session.transcriptLog?.end();
    session.transcriptLog = undefined;
  };

  const emitStateIfChanged = (
    session: TerminalSession,
    sessionId: string,
    nextState: AgentRuntimeState | null,
  ) => {
    if (!nextState || nextState === session.agentState) {
      return;
    }

    session.agentState = nextState;
    appendDebugLog(session, `state-change session=${sessionId} state=${nextState}`);
    appendTranscriptEvent(session, sessionId, {
      type: "state_change",
      state: nextState,
      timestamp: new Date().toISOString(),
    });
    onStateChange?.(sessionId, nextState, session.lastToolName);
    broadcastMessage(session, {
      type: "state",
      state: nextState,
      ...(session.lastToolName ? { toolName: session.lastToolName } : {}),
    });
  };

  const resolveSession =
    resolveTerminalSession ??
    ((terminalId: string) => {
      if (!terminals.has(terminalId)) {
        return null;
      }
      const terminal = terminals.get(terminalId);
      return {
        sessionId: terminalId,
        tentacleId: terminal?.tentacleId ?? terminalId,
      };
    });

  const clearIdleCloseTimer = (session: TerminalSession) => {
    if (!session.idleCloseTimer) {
      return;
    }

    clearTimeout(session.idleCloseTimer);
    session.idleCloseTimer = undefined;
  };

  const appendScrollback = (session: TerminalSession, chunk: string) => {
    let nextChunk = chunk;
    let nextChunkBytes = Buffer.byteLength(nextChunk, "utf8");
    if (nextChunkBytes > scrollbackMaxBytes) {
      const chunkBuffer = Buffer.from(nextChunk, "utf8");
      nextChunk = chunkBuffer.subarray(chunkBuffer.length - scrollbackMaxBytes).toString("utf8");
      nextChunkBytes = Buffer.byteLength(nextChunk, "utf8");
      session.scrollbackChunks = [];
      session.scrollbackBytes = 0;
    }

    session.scrollbackChunks.push(nextChunk);
    session.scrollbackBytes += nextChunkBytes;
    while (session.scrollbackBytes > scrollbackMaxBytes && session.scrollbackChunks.length > 0) {
      const removedChunk = session.scrollbackChunks.shift();
      if (!removedChunk) {
        break;
      }

      session.scrollbackBytes -= Buffer.byteLength(removedChunk, "utf8");
    }
  };

  const stripBrokenLeadingAnsi = (text: string): string => {
    let nextText = text;

    while (nextText.length > 0) {
      if (nextText.startsWith("\u001b")) {
        return nextText;
      }

      const oscMatch = nextText.match(BROKEN_OSC_TAIL_RE);
      if (oscMatch) {
        nextText = nextText.slice(oscMatch[0].length);
        continue;
      }

      const csiTailMatch = nextText.match(/^\[[0-9:;<=>?]*[ -/]*[@-~]/);
      if (csiTailMatch) {
        nextText = nextText.slice(csiTailMatch[0].length);
        continue;
      }

      const orphanedCsiTailMatch = nextText.match(
        /^(?=[0-9:;<=>?]*[;:<=>?])[0-9:;<=>?]*[ -/]*[@-~]/,
      );
      if (orphanedCsiTailMatch) {
        nextText = nextText.slice(orphanedCsiTailMatch[0].length);
        continue;
      }

      break;
    }

    return nextText;
  };

  const sendHistory = (websocket: WebSocket, session: TerminalSession) => {
    if (session.scrollbackChunks.length === 0) {
      return;
    }

    sendMessage(websocket, {
      type: "history",
      data: stripBrokenLeadingAnsi(session.scrollbackChunks.join("")),
    });
  };

  const closeSession = (sessionId: string): boolean => {
    const session = sessions.get(sessionId);
    if (!session) {
      return false;
    }

    clearIdleCloseTimer(session);
    closeTranscript(session, sessionId, {
      type: "session_end",
      reason: "session_close",
      timestamp: new Date().toISOString(),
    });
    try {
      session.pty.kill();
    } catch {
      // Ignore teardown errors; session will still be discarded.
    }

    if (session.statePollTimer) {
      clearInterval(session.statePollTimer);
    }
    session.debugLog?.end();
    sessions.delete(sessionId);
    return true;
  };

  const INITIAL_PROMPT_DELAY_MS = 4_000;
  // Claude Code's multi-line bracketed-paste handler shows
  // '[Pasted text #1 +N lines]' and waits on Enter to submit. 150ms
  // wasn't enough for the paste buffer to finalize before our Enter
  // arrived, so the Enter got consumed as part of paste-processing,
  // not as a submit — leaving the prompt staged but not sent. 2000ms
  // gives Claude Code time to finalize and register our Enter as a
  // real submit, even under concurrent-spawn load.
  const INITIAL_PROMPT_SUBMIT_DELAY_MS = 2_000;
  const CLAUDE_SLASH_COMMAND_DELAY_MS = 600;
  const BRACKETED_PASTE_START = "\x1b[200~";
  const BRACKETED_PASTE_END = "\x1b[201~";

  const scheduleIdleCloseIfNeeded = (session: TerminalSession, sessionId: string) => {
    if (session.keepAliveWithoutClients) {
      return;
    }

    if (session.clients.size > 0 || session.directListeners.size > 0) {
      return;
    }

    appendDebugLog(
      session,
      `idle-grace-start session=${sessionId} timeoutMs=${sessionIdleGraceMs}`,
    );
    clearIdleCloseTimer(session);
    session.idleCloseTimer = setTimeout(() => {
      appendDebugLog(session, `idle-grace-expired session=${sessionId}`);
      closeSession(sessionId);
    }, sessionIdleGraceMs);
  };

  // Bootstrap phases, for claude-code, in order:
  //   1. Write the agent bootstrap command (`claude\r`).
  //   2. Wait until claude's TUI is ready to accept input.
  //   3. Write `/effort auto\r` to select the model tier.
  //   4. Wait until claude is ready again.
  //   5. Bracketed-paste the initial prompt.
  //   6. Write `\r` to submit.
  //   7. Confirm the submit landed. Retry from (5) if it was eaten.
  //
  // Legacy path (OCTOGENT_HOOK_GATED_BOOTSTRAP=0 or non-claude providers):
  // steps (2) and (4) are fixed setTimeout delays, and (7) is "best effort
  // write an Enter and hope". That path is the single biggest source of
  // the "[Pasted text +N lines]" staged-but-unsubmitted failure mode under
  // concurrent spawns.
  //
  // Hook-gated path (default, claude-code): steps (2), (4), and (7) are
  // gated on counters bumped by the Claude Code hook callbacks —
  // notification.idle_prompt for ready, user-prompt-submit for landed.
  // System load no longer racing against wall-clock timers; instead, each
  // phase transitions on Claude's own "I'm ready" / "I received your
  // prompt" signal. The legacy timer values become hard sanity caps only.
  const HOOK_READY_TIMEOUT_MS = 15_000;
  const HOOK_EFFORT_IDLE_TIMEOUT_MS = 5_000;
  const HOOK_SUBMIT_TIMEOUT_MS = 5_000;
  const PASTE_RENDER_DELAY_MS = 400;
  // How many total submit attempts we make: the first is paste + \r, any
  // subsequent attempts are bare \r (never re-paste — that would duplicate
  // the prompt body in the submitted message).
  const MAX_SUBMIT_ATTEMPTS = 3;
  const HOOK_POLL_INTERVAL_MS = 50;

  type CounterKey = "idlePromptCount" | "userPromptSubmitCount";
  type CounterWatch = { key: CounterKey; baseline: number; label: string };

  const waitForCounterIncrement = async (
    sessionId: string,
    session: TerminalSession,
    watches: CounterWatch[],
    timeoutMs: number,
  ): Promise<string> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (sessions.get(sessionId) !== session) {
        return "aborted";
      }
      for (const { key, baseline, label } of watches) {
        const current = session[key] ?? 0;
        if (current > baseline) {
          return label;
        }
      }
      await new Promise<void>((resolve) => setTimeout(resolve, HOOK_POLL_INTERVAL_MS));
    }
    return "timeout";
  };

  const runLegacyTimerBootstrap = (
    sessionId: string,
    session: TerminalSession,
    provider: string,
  ) => {
    if (provider === "claude-code") {
      setTimeout(() => {
        if (sessions.get(sessionId) !== session) {
          return;
        }
        appendDebugLog(session, `effort-auto session=${sessionId} path=legacy`);
        session.pty.write("/effort auto\r");
        session.pty.write("/model opusplan\r");
      }, INITIAL_PROMPT_DELAY_MS);
    }

    const promptInjectionDelayMs =
      provider === "claude-code"
        ? INITIAL_PROMPT_DELAY_MS + CLAUDE_SLASH_COMMAND_DELAY_MS
        : INITIAL_PROMPT_DELAY_MS;

    if (session.initialPrompt && !session.isInitialPromptSent) {
      setTimeout(() => {
        if (session.isInitialPromptSent) {
          return;
        }
        session.isInitialPromptSent = true;
        appendDebugLog(session, `initial-prompt session=${sessionId} path=legacy`);
        const prompt = session.initialPrompt ?? "";
        session.pty.write(`${BRACKETED_PASTE_START}${prompt}${BRACKETED_PASTE_END}`);
        setTimeout(() => {
          if (sessions.get(sessionId) !== session) {
            return;
          }
          appendDebugLog(session, `initial-prompt-submit session=${sessionId} path=legacy`);
          session.pty.write("\r");
        }, INITIAL_PROMPT_SUBMIT_DELAY_MS);
      }, promptInjectionDelayMs);
    }

    if (session.initialInputDraft && !session.isInitialInputDraftSent && !session.initialPrompt) {
      setTimeout(() => {
        if (session.isInitialInputDraftSent) {
          return;
        }
        session.isInitialInputDraftSent = true;
        appendDebugLog(session, `initial-input-draft session=${sessionId} path=legacy`);
        const draft = session.initialInputDraft ?? "";
        session.pty.write(`${BRACKETED_PASTE_START}${draft}${BRACKETED_PASTE_END}`);
      }, promptInjectionDelayMs);
    }
  };

  const runHookGatedClaudeBootstrap = async (
    sessionId: string,
    session: TerminalSession,
  ): Promise<void> => {
    // Phase: wait for claude TUI to be ready to accept input.
    // Baseline is 0, not the current count, because an idle_prompt may
    // already have been buffered and drained into this session before the
    // state machine captured a fresh baseline (see drainPendingHookEvents
    // and onSessionRegistered). Any idle_prompt that ever fired for this
    // session is a valid "claude booted" signal — we don't need a fresh
    // one.
    const readySignal = await waitForCounterIncrement(
      sessionId,
      session,
      [{ key: "idlePromptCount", baseline: 0, label: "idle" }],
      HOOK_READY_TIMEOUT_MS,
    );
    if (readySignal === "aborted") {
      return;
    }
    if (readySignal === "timeout") {
      appendDebugLog(session, `hook-ready-timeout session=${sessionId} falling back to timer`);
      // Give claude a minimum boot window before we start injecting.
      await new Promise<void>((resolve) => setTimeout(resolve, INITIAL_PROMPT_DELAY_MS));
    }

    // Phase: /effort auto to select model tier.
    appendDebugLog(session, `effort-auto session=${sessionId} path=hook`);
    session.pty.write("/effort auto\r");
    const idleBaseline1 = session.idlePromptCount ?? 0;
    const effortResult = await waitForCounterIncrement(
      sessionId,
      session,
      [{ key: "idlePromptCount", baseline: idleBaseline1, label: "idle" }],
      HOOK_EFFORT_IDLE_TIMEOUT_MS,
    );
    if (effortResult === "aborted") {
      return;
    }
    if (effortResult === "timeout") {
      // /effort auto may have succeeded silently on versions that don't
      // fire idle_prompt for slash commands. Proceed anyway after a
      // small render buffer.
      await new Promise<void>((resolve) => setTimeout(resolve, CLAUDE_SLASH_COMMAND_DELAY_MS));
    }

    // Phase: /model opusplan to select the model.
    appendDebugLog(session, `model-opusplan session=${sessionId} path=hook`);
    session.pty.write("/model opusplan\r");
    const idleBaseline2 = session.idlePromptCount ?? 0;
    const modelResult = await waitForCounterIncrement(
      sessionId,
      session,
      [{ key: "idlePromptCount", baseline: idleBaseline2, label: "idle" }],
      HOOK_EFFORT_IDLE_TIMEOUT_MS,
    );
    if (modelResult === "aborted") {
      return;
    }
    if (modelResult === "timeout") {
      await new Promise<void>((resolve) => setTimeout(resolve, CLAUDE_SLASH_COMMAND_DELAY_MS));
    }

    // Phase: inject initial prompt, then wait for submit confirmation.
    //
    // We intentionally do NOT treat idle_prompt as a retry trigger. Primary-
    // source observation: Claude Code fires idle_prompt the moment its TUI
    // renders "[Pasted text +N lines]" — BEFORE our \r is processed. That
    // idle event is indistinguishable from "my Enter was eaten and claude
    // is still idle waiting". Racing submit vs idle caused false retries
    // that double-pasted the prompt on the happy path. (Empirically
    // verified by the user: every worker got the prompt injected twice.)
    //
    // Correct strategy: paste once, wait for user-prompt-submit with a
    // timeout. If the submit doesn't confirm, retry with a BARE `\r` only
    // — never re-paste. A bare \r either submits the staged paste (fixing
    // the original eaten-Enter bug) or becomes a harmless empty submission
    // (when paste already submitted and we just didn't see the hook). It
    // can never cause a duplicate prompt body.
    if (session.initialPrompt && !session.isInitialPromptSent) {
      session.isInitialPromptSent = true;
      const prompt = session.initialPrompt;

      appendDebugLog(session, `initial-prompt session=${sessionId} path=hook`);
      const submitBeforePaste = session.userPromptSubmitCount ?? 0;
      session.pty.write(`${BRACKETED_PASTE_START}${prompt}${BRACKETED_PASTE_END}`);
      await new Promise<void>((resolve) => setTimeout(resolve, PASTE_RENDER_DELAY_MS));
      appendDebugLog(session, `initial-prompt-submit session=${sessionId} path=hook attempt=1`);
      session.pty.write("\r");

      let landed = false;
      for (let attempt = 1; attempt <= MAX_SUBMIT_ATTEMPTS; attempt++) {
        const signal = await waitForCounterIncrement(
          sessionId,
          session,
          [
            {
              key: "userPromptSubmitCount",
              baseline: submitBeforePaste,
              label: "submit",
            },
          ],
          HOOK_SUBMIT_TIMEOUT_MS,
        );

        if (signal === "aborted") {
          return;
        }
        if (signal === "submit") {
          appendDebugLog(
            session,
            `initial-prompt-confirmed session=${sessionId} attempt=${attempt}`,
          );
          landed = true;
          break;
        }

        // Timeout: submit hasn't been observed. Send one more bare \r in
        // case the paste is staged but our original Enter was consumed by
        // paste finalization. Never re-paste — that's how we get
        // duplicates.
        if (attempt < MAX_SUBMIT_ATTEMPTS) {
          appendDebugLog(
            session,
            `initial-prompt-bare-retry session=${sessionId} attempt=${attempt + 1}`,
          );
          session.pty.write("\r");
        }
      }

      if (!landed) {
        appendDebugLog(
          session,
          `initial-prompt-gave-up session=${sessionId} attempts=${MAX_SUBMIT_ATTEMPTS}`,
        );
      }
    }

    // Phase: inject input draft (no submit) if applicable.
    if (session.initialInputDraft && !session.isInitialInputDraftSent && !session.initialPrompt) {
      session.isInitialInputDraftSent = true;
      appendDebugLog(session, `initial-input-draft session=${sessionId} path=hook`);
      session.pty.write(
        `${BRACKETED_PASTE_START}${session.initialInputDraft}${BRACKETED_PASTE_END}`,
      );
    }
  };

  const ensureAgentBootstrapped = (sessionId: string, session: TerminalSession) => {
    if (session.isBootstrapCommandSent) {
      return;
    }

    session.isBootstrapCommandSent = true;
    const terminal = terminals.get(session.terminalId);
    const provider = terminal?.agentProvider ?? DEFAULT_AGENT_PROVIDER;

    const bootstrapCommand =
      TERMINAL_BOOTSTRAP_COMMANDS[provider] ?? TERMINAL_BOOTSTRAP_COMMANDS[DEFAULT_AGENT_PROVIDER];
    appendDebugLog(session, `bootstrap session=${sessionId} command=${bootstrapCommand}`);
    session.pty.write(`${bootstrapCommand}\r`);

    // Feature flag: `OCTOGENT_HOOK_GATED_BOOTSTRAP=0` forces the old timer
    // behavior without a rebuild, giving the operator a kill switch if
    // the signal-gated path misbehaves on their claude-code version.
    const hookGatingDisabled = process.env.OCTOGENT_HOOK_GATED_BOOTSTRAP === "0";

    if (provider === "claude-code" && !hookGatingDisabled) {
      void runHookGatedClaudeBootstrap(sessionId, session).catch((err) => {
        appendDebugLog(session, `bootstrap-error session=${sessionId} ${toErrorMessage(err)}`);
      });
      return;
    }

    runLegacyTimerBootstrap(sessionId, session, provider);
  };

  const ensureSession = (sessionId: string, tentacleId: string) => {
    const existingSession = sessions.get(sessionId);
    if (existingSession) {
      return existingSession;
    }

    const terminalRecord = terminals.get(sessionId);

    const tentacleCwd = getTentacleWorkspaceCwd(tentacleId);
    if (!existsSync(tentacleCwd)) {
      throw new Error(`Terminal working directory does not exist: ${tentacleCwd}`);
    }

    ensureNodePtySpawnHelperExecutable();
    const shellLaunch = getShellLaunch();

    const resolvedRole: "coordinator" | "worker" | "standalone" = terminalRecord?.parentTerminalId
      ? "worker"
      : terminalRecord?.workspaceMode === "shared"
        ? "coordinator"
        : "standalone";

    let pty: IPty;
    try {
      pty = spawn(shellLaunch.command, shellLaunch.args, {
        cols: DEFAULT_PTY_COLS,
        rows: DEFAULT_PTY_ROWS,
        cwd: tentacleCwd,
        env: createShellEnvironment({
          octogentSessionId: sessionId,
          terminalId: sessionId,
          tentacleId: terminalRecord?.tentacleId ?? tentacleId,
          parentTerminalId: terminalRecord?.parentTerminalId,
          role: resolvedRole,
          apiBaseUrl: getApiBaseUrl?.(),
        }),
        name: "xterm-256color",
      });
    } catch (error) {
      throw new Error(
        `Unable to start terminal shell (${shellLaunch.command}): ${toErrorMessage(error)}`,
      );
    }

    const stateTracker = new AgentStateTracker();
    const debugLog = createDebugLog(sessionId);
    const transcriptLog = createTranscriptLog(sessionId);
    const session: TerminalSession = {
      terminalId: sessionId,
      tentacleId,
      pty,
      clients: new Set(),
      directListeners: new Set(),
      cols: DEFAULT_PTY_COLS,
      rows: DEFAULT_PTY_ROWS,
      agentState: stateTracker.currentState,
      stateTracker,
      isBootstrapCommandSent: false,
      scrollbackChunks: [],
      scrollbackBytes: 0,
      transcriptEventCount: 0,
      pendingInput: "",
      hasTranscriptEnded: false,
      keepAliveWithoutClients: Boolean(terminalRecord?.initialPrompt),
    };
    if (debugLog) {
      session.debugLog = debugLog;
    }
    session.transcriptLog = transcriptLog;

    appendDebugLog(session, `session-start session=${sessionId} tentacle=${tentacleId}`);
    appendTranscriptEvent(session, sessionId, {
      type: "session_start",
      timestamp: new Date().toISOString(),
    });
    session.statePollTimer = setInterval(() => {
      emitStateIfChanged(session, sessionId, session.stateTracker.poll(Date.now()));
    }, 300);

    session.pty.onData((chunk) => {
      appendDebugLog(session, `pty-output session=${sessionId} chunk=${JSON.stringify(chunk)}`);
      appendScrollback(session, chunk);
      const nextState = session.stateTracker.observeChunk(chunk, Date.now());
      broadcastMessage(session, {
        type: "output",
        data: chunk,
      });
      emitStateIfChanged(session, sessionId, nextState);
    });

    session.pty.onExit(({ exitCode, signal }) => {
      const message = `\r\n[terminal exited (code ${exitCode}, signal ${signal})]\r\n`;
      broadcastMessage(session, {
        type: "output",
        data: message,
      });
      for (const client of session.clients) {
        if (client.readyState === 1) {
          client.close();
        }
      }

      appendDebugLog(
        session,
        `session-exit session=${sessionId} code=${exitCode} signal=${signal}`,
      );
      closeTranscript(session, sessionId, {
        type: "session_end",
        reason: "pty_exit",
        ...(Number.isFinite(exitCode) ? { exitCode } : {}),
        ...(Number.isFinite(signal) ? { signal } : {}),
        timestamp: new Date().toISOString(),
      });
      if (session.statePollTimer) {
        clearInterval(session.statePollTimer);
      }
      session.debugLog?.end();
      sessions.delete(sessionId);
    });

    // Propagate initial prompt from the terminal definition, if set.
    if (terminalRecord?.initialPrompt) {
      session.initialPrompt = terminalRecord.initialPrompt;
    }
    if (terminalRecord?.initialInputDraft) {
      session.initialInputDraft = terminalRecord.initialInputDraft;
    }

    sessions.set(sessionId, session);
    // Drain any hook events that arrived between installHooksInDirectory
    // (done during createTerminal, before this PTY was spawned) and now.
    // Tiny race window in normal conditions, but under 5+ concurrent
    // spawns the curl callback can beat us to the map.
    onSessionRegistered?.(sessionId);
    return session;
  };

  const handleUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer): boolean => {
    const terminalId = getTerminalId(request);
    if (!terminalId) {
      return false;
    }

    const resolvedSession = resolveSession(terminalId);
    if (!resolvedSession) {
      return false;
    }
    const { sessionId, tentacleId } = resolvedSession;

    websocketServer.handleUpgrade(request, socket, head, (websocket: WebSocket) => {
      let session: TerminalSession;
      try {
        session = ensureSession(sessionId, tentacleId);
      } catch {
        sendMessage(websocket, {
          type: "output",
          data: "\r\n[terminal failed to start]\r\n",
        });
        websocket.close();
        return;
      }

      session.clients.add(websocket);
      appendDebugLog(session, `ws-open session=${sessionId} clients=${session.clients.size}`);
      clearIdleCloseTimer(session);
      ensureAgentBootstrapped(sessionId, session);
      sendHistory(websocket, session);
      sendMessage(websocket, {
        type: "state",
        state: session.agentState,
      });

      websocket.on("message", (raw: unknown) => {
        const text =
          typeof raw === "string" ? raw : raw instanceof Buffer ? raw.toString() : String(raw);
        try {
          const payload = JSON.parse(text) as
            | { type: "input"; data: string }
            | { type: "resize"; cols: number; rows: number };

          if (payload.type === "input" && typeof payload.data === "string") {
            appendDebugLog(
              session,
              `ws-input session=${sessionId} data=${JSON.stringify(payload.data)}`,
            );
            session.pty.write(payload.data);
            if (/[\r\n]/.test(payload.data)) {
              emitStateIfChanged(
                session,
                sessionId,
                session.stateTracker.observeSubmit(Date.now()),
              );
            }
            return;
          }

          if (
            payload.type === "resize" &&
            Number.isFinite(payload.cols) &&
            Number.isFinite(payload.rows)
          ) {
            const nextCols = Math.max(20, Math.floor(payload.cols));
            const nextRows = Math.max(10, Math.floor(payload.rows));
            if (session.cols === nextCols && session.rows === nextRows) {
              return;
            }

            session.cols = nextCols;
            session.rows = nextRows;
            session.pty.resize(nextCols, nextRows);
          }
        } catch {
          session.pty.write(text);
        }
      });

      websocket.on("close", () => {
        session.clients.delete(websocket);
        appendDebugLog(session, `ws-close session=${sessionId} clients=${session.clients.size}`);
        scheduleIdleCloseIfNeeded(session, sessionId);
      });
    });

    return true;
  };

  const close = () => {
    for (const sessionId of sessions.keys()) {
      closeSession(sessionId);
    }
  };

  const connectDirect = (
    terminalId: string,
    listener: DirectSessionListener,
  ): (() => void) | null => {
    const resolvedSession = resolveSession(terminalId);
    if (!resolvedSession) {
      return null;
    }
    const { sessionId, tentacleId } = resolvedSession;

    let session: TerminalSession;
    try {
      session = ensureSession(sessionId, tentacleId);
    } catch {
      return null;
    }

    session.directListeners.add(listener);
    clearIdleCloseTimer(session);
    ensureAgentBootstrapped(sessionId, session);

    // Send history and current state to the new listener
    if (session.scrollbackChunks.length > 0) {
      listener({ type: "history", data: session.scrollbackChunks.join("") });
    }
    listener({ type: "state", state: session.agentState });

    return () => {
      session.directListeners.delete(listener);
      scheduleIdleCloseIfNeeded(session, sessionId);
    };
  };

  const startSession = (terminalId: string): boolean => {
    const resolvedSession = resolveSession(terminalId);
    if (!resolvedSession) {
      return false;
    }

    const { sessionId, tentacleId } = resolvedSession;
    let session: TerminalSession;
    try {
      session = ensureSession(sessionId, tentacleId);
    } catch {
      return false;
    }

    clearIdleCloseTimer(session);
    ensureAgentBootstrapped(sessionId, session);
    return true;
  };

  const writeInput = (terminalId: string, data: string): boolean => {
    const session = sessions.get(terminalId);
    if (!session) {
      return false;
    }

    session.pty.write(data);
    if (/[\r\n]/.test(data)) {
      emitStateIfChanged(session, terminalId, session.stateTracker.observeSubmit(Date.now()));
    }
    return true;
  };

  const resizeSession = (terminalId: string, cols: number, rows: number): boolean => {
    const session = sessions.get(terminalId);
    if (!session) {
      return false;
    }

    const nextCols = Math.max(20, Math.floor(cols));
    const nextRows = Math.max(10, Math.floor(rows));
    if (session.cols === nextCols && session.rows === nextRows) {
      return true;
    }

    session.cols = nextCols;
    session.rows = nextRows;
    session.pty.resize(nextCols, nextRows);
    return true;
  };

  return {
    closeSession,
    handleUpgrade,
    connectDirect,
    startSession,
    writeInput,
    resizeSession,
    close,
  };
};
