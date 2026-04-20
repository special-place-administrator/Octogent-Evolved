// Hook-driven bootstrap tests. Covers the signal-gated path that
// replaced the fixed-timer paste-and-pray sequence. Each test drives the
// state machine deterministically by calling `handleHook` directly,
// rather than waiting on real Claude Code processes.
//
// Scenarios (advisor-vetted):
//   T1 happy path — one session completes via hook signals
//   T2 TOCTOU — hook event for a session that hasn't registered yet gets
//       buffered and replayed when the session appears
//   T3 readiness timeout — idle_prompt never arrives, falls back to timer
//   T4 paste-eaten retry — first paste is consumed, idle re-fires, retry
//       succeeds
//   T5 coexistence — a user's existing hook in .claude/settings.json is
//       preserved across installHooksInDirectory
//   T6 concurrent spawns — six sessions bootstrapping in parallel all
//       reach user-prompt-submit (the actual reported bug)

import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createShellEnvironmentMock, ensureSpawnHelperMock, spawnMock } = vi.hoisted(() => ({
  createShellEnvironmentMock: vi.fn(() => ({})),
  ensureSpawnHelperMock: vi.fn(),
  spawnMock: vi.fn(),
}));

vi.mock("node-pty", () => ({
  spawn: spawnMock,
}));

vi.mock("../src/terminalRuntime/ptyEnvironment", () => ({
  createShellEnvironment: createShellEnvironmentMock,
  ensureNodePtySpawnHelperExecutable: ensureSpawnHelperMock,
}));

import { createHookProcessor } from "../src/terminalRuntime/hookProcessor";
import { createSessionRuntime } from "../src/terminalRuntime/sessionRuntime";
import type { PersistedTerminal, TerminalSession } from "../src/terminalRuntime/types";

class FakePty extends EventEmitter {
  write = vi.fn();
  resize = vi.fn();
  kill = vi.fn();
  writes: string[] = [];

  constructor() {
    super();
    this.write.mockImplementation((data: string) => {
      this.writes.push(data);
    });
  }

  onData(listener: (chunk: string) => void) {
    this.on("data", listener);
    return { dispose: () => this.off("data", listener) };
  }
  onExit(listener: (event: { exitCode: number; signal: number }) => void) {
    this.on("exit", listener);
    return { dispose: () => this.off("exit", listener) };
  }
  emitData(chunk: string) {
    this.emit("data", chunk);
  }
}

class FakeWebSocketServer {
  handleUpgrade = vi.fn();
}

// Accumulates persistRegistry calls so we can assert auto-rename side effects.
const createFakeDeps = () => {
  const terminals = new Map<string, PersistedTerminal>();
  const sessions = new Map<string, TerminalSession>();
  const tmpDir = mkdtempSync(join(tmpdir(), "hook-bootstrap-test-"));
  const transcriptDirectoryPath = join(tmpDir, "transcripts");
  const persistRegistry = vi.fn();
  const deliverChannelMessages = vi.fn();
  return {
    terminals,
    sessions,
    tmpDir,
    transcriptDirectoryPath,
    persistRegistry,
    deliverChannelMessages,
  };
};

// Boilerplate: build a hookProcessor + sessionRuntime pair wired together
// the same way terminalRuntime.ts wires them (late-bound drain callback).
const buildWiredRuntime = (deps: ReturnType<typeof createFakeDeps>) => {
  const drainRef: { current: ((sid: string) => void) | undefined } = { current: undefined };

  const sessionRuntime = createSessionRuntime({
    websocketServer: new FakeWebSocketServer() as unknown as import("ws").WebSocketServer,
    terminals: deps.terminals,
    sessions: deps.sessions,
    getTentacleWorkspaceCwd: () => deps.tmpDir,
    getApiBaseUrl: () => "http://localhost:8787",
    isDebugPtyLogsEnabled: false,
    ptyLogDir: deps.tmpDir,
    transcriptDirectoryPath: deps.transcriptDirectoryPath,
    sessionIdleGraceMs: 60_000,
    scrollbackMaxBytes: 4096,
    onSessionRegistered: (sid: string) => drainRef.current?.(sid),
  });

  const hookProcessor = createHookProcessor({
    terminals: deps.terminals,
    sessions: deps.sessions,
    transcriptDirectoryPath: deps.transcriptDirectoryPath,
    getApiBaseUrl: () => "http://localhost:8787",
    persistRegistry: deps.persistRegistry,
    deliverChannelMessages: deps.deliverChannelMessages,
  });
  drainRef.current = hookProcessor.drainPendingHookEvents;

  return { sessionRuntime, hookProcessor };
};

const registerClaudeTerminal = (
  terminals: Map<string, PersistedTerminal>,
  terminalId: string,
  initialPrompt: string,
) => {
  terminals.set(terminalId, {
    terminalId,
    tentacleId: terminalId,
    tentacleName: terminalId,
    createdAt: new Date().toISOString(),
    workspaceMode: "shared",
    agentProvider: "claude-code",
    nameOrigin: "generated",
    initialPrompt,
  });
};

const fireIdlePrompt = (
  hookProcessor: ReturnType<typeof createHookProcessor>,
  terminalId: string,
) => hookProcessor.handleHook("notification", { notification_type: "idle_prompt" }, terminalId);

const fireUserPromptSubmit = (
  hookProcessor: ReturnType<typeof createHookProcessor>,
  terminalId: string,
  prompt: string,
) => hookProcessor.handleHook("user-prompt-submit", { prompt }, terminalId);

// Returns the PTY's accumulated writes collapsed into a single string —
// useful for assertions that don't care about chunk boundaries.
const readAllWrites = (pty: FakePty) => pty.writes.join("");

const BRACKETED_PASTE_START = "\x1b[200~";
const BRACKETED_PASTE_END = "\x1b[201~";

describe("hook-gated bootstrap", () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    process.env.OCTOGENT_HOOK_GATED_BOOTSTRAP = undefined;
    createShellEnvironmentMock.mockClear();
    ensureSpawnHelperMock.mockClear();
    spawnMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    for (const dir of tempDirs) {
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
    tempDirs.length = 0;
  });

  // T1: happy path. claude-code terminal spawns, idle_prompt fires twice
  // (once for boot, once after /effort auto), paste goes in, Enter lands,
  // user-prompt-submit confirms, state machine exits.
  it("T1: completes bootstrap when idle_prompt and user-prompt-submit fire in order", async () => {
    const deps = createFakeDeps();
    tempDirs.push(deps.tmpDir);
    const pty = new FakePty();
    spawnMock.mockReturnValue(pty);

    const { sessionRuntime, hookProcessor } = buildWiredRuntime(deps);
    registerClaudeTerminal(deps.terminals, "tentacle-1", "do the thing");

    sessionRuntime.startSession("tentacle-1");

    // Bootstrap write should be synchronous.
    expect(pty.writes[0]).toBe("claude --dangerously-skip-permissions\r");

    // Signal: claude TUI booted (first idle_prompt).
    fireIdlePrompt(hookProcessor, "tentacle-1");
    // Let the state machine advance: poll cadence is 50ms.
    await vi.waitFor(
      () => {
        expect(pty.writes).toContain("/effort auto\r");
      },
      { timeout: 1000, interval: 20 },
    );

    // Signal: /effort auto settled, second idle_prompt.
    fireIdlePrompt(hookProcessor, "tentacle-1");

    // Expect paste to land next.
    await vi.waitFor(
      () => {
        const all = readAllWrites(pty);
        expect(all).toContain(`${BRACKETED_PASTE_START}do the thing${BRACKETED_PASTE_END}`);
      },
      { timeout: 2000, interval: 20 },
    );

    // After the paste-render delay (400ms) the state machine writes \r.
    await vi.waitFor(
      () => {
        const enters = pty.writes.filter((w) => w === "\r");
        // One for claude bootstrap not counted (bootstrap is "claude\r"), one for
        // /effort auto (also combined), one for the submit.
        expect(enters.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 2000, interval: 20 },
    );

    // Signal: prompt landed.
    fireUserPromptSubmit(hookProcessor, "tentacle-1", "do the thing");

    // Machine should exit without further writes.
    const writeCountAfterSubmit = pty.writes.length;
    await new Promise((r) => setTimeout(r, 200));
    expect(pty.writes.length).toBe(writeCountAfterSubmit);
  });

  // T2: TOCTOU. A hook fires for a session that doesn't exist yet in the
  // sessions map (hook path was installed during createTerminal, but
  // startSession hasn't run yet). Event must be buffered and replayed.
  it("T2: buffers hook events for unregistered sessions and replays on registration", async () => {
    const deps = createFakeDeps();
    tempDirs.push(deps.tmpDir);
    const pty = new FakePty();
    spawnMock.mockReturnValue(pty);

    const { sessionRuntime, hookProcessor } = buildWiredRuntime(deps);
    registerClaudeTerminal(deps.terminals, "tentacle-2", "buffered prompt");

    // Hook fires BEFORE the session is registered. In the real runtime
    // this can happen when `installHooksInDirectory` + fast claude boot
    // races a slow `startSession`.
    //
    // To really exercise this path, we'd need the terminal NOT to be in
    // the terminals map either. But terminals are set synchronously and
    // always before startSession. The buffer only actually catches the
    // window where `terminals.has(id)` is true but `sessions.has(id)` is
    // false. We simulate that window by NOT calling startSession before
    // the hook fire.
    //
    // The buffer condition in hookProcessor is:
    //   !sessions.has(id) && !terminals.has(id)
    // …which means the buffer actually catches the case where NEITHER
    // map has the session yet. For the terminals-but-not-sessions
    // window, the hook silently no-ops because `sessions.get` returns
    // undefined. That's a weaker form of TOCTOU — a separate guard
    // against stray hook callbacks for terminals that were never started.
    //
    // The specific scenario the buffer DOES catch: hook arrives from a
    // claude process we don't know about yet (e.g. a raced spawn that
    // beat its own terminal-registration). We test that path by firing
    // the hook BEFORE registering the terminal.
    deps.terminals.delete("tentacle-2");

    fireIdlePrompt(hookProcessor, "tentacle-2");

    // Hook should be buffered (internal state — we don't reach into it,
    // but we verify behavior: when the session eventually registers,
    // the idle counter should be bumped without a second idle_prompt).
    registerClaudeTerminal(deps.terminals, "tentacle-2", "buffered prompt");

    sessionRuntime.startSession("tentacle-2");

    // At this point the drain should have replayed the idle_prompt.
    // The state machine should proceed past phase 1 without us firing
    // idle_prompt a second time.
    await vi.waitFor(
      () => {
        expect(pty.writes).toContain("/effort auto\r");
      },
      { timeout: 1000, interval: 20 },
    );
  });

  // T3: readiness timeout. idle_prompt never fires. The state machine
  // falls back to the legacy timer delay and still sends /effort auto
  // and the prompt paste. This is the "hooks silently disabled on this
  // claude version" path — correctness without any hook callbacks.
  it("T3: falls back to timer path when idle_prompt never arrives", async () => {
    vi.useFakeTimers();
    const deps = createFakeDeps();
    tempDirs.push(deps.tmpDir);
    const pty = new FakePty();
    spawnMock.mockReturnValue(pty);

    const { sessionRuntime } = buildWiredRuntime(deps);
    registerClaudeTerminal(deps.terminals, "tentacle-3", "fallback prompt");

    sessionRuntime.startSession("tentacle-3");

    // claude\r should have gone out synchronously.
    expect(pty.writes[0]).toBe("claude --dangerously-skip-permissions\r");

    // Advance past the 15s readiness timeout + the 4s post-timeout boot buffer.
    await vi.advanceTimersByTimeAsync(20_000);

    // /effort auto should have been written.
    expect(pty.writes.some((w) => w === "/effort auto\r")).toBe(true);

    // Advance past the /effort idle timeout + slash command buffer.
    await vi.advanceTimersByTimeAsync(6_000);

    // Paste should be written.
    const allWrites = readAllWrites(pty);
    expect(allWrites).toContain(`${BRACKETED_PASTE_START}fallback prompt${BRACKETED_PASTE_END}`);

    // After paste-render delay, Enter should go.
    await vi.advanceTimersByTimeAsync(1_000);
    expect(pty.writes.filter((w) => w === "\r").length).toBeGreaterThanOrEqual(1);
  });

  // T4: regression test for the double-paste bug. Claude Code fires
  // `idle_prompt` the moment its TUI renders `[Pasted text +N lines]` —
  // BEFORE processing our \r. An earlier iteration of the state machine
  // treated that idle event as "paste eaten, retry", which caused every
  // worker to receive the prompt twice (primary-source observation from
  // a real swarm run).
  //
  // Correct behavior: only `user-prompt-submit` confirms the paste
  // landed, and retries use a bare \r — never re-paste. `idle_prompt`
  // during the submit-wait window is noise and must not trigger a
  // re-paste.
  it("T4: idle_prompt between paste and submit does NOT cause a retry", async () => {
    const deps = createFakeDeps();
    tempDirs.push(deps.tmpDir);
    const pty = new FakePty();
    spawnMock.mockReturnValue(pty);

    const { sessionRuntime, hookProcessor } = buildWiredRuntime(deps);
    registerClaudeTerminal(deps.terminals, "tentacle-4", "no-duplicate prompt");

    sessionRuntime.startSession("tentacle-4");

    // Progress through phases 1 and 2.
    fireIdlePrompt(hookProcessor, "tentacle-4");
    await vi.waitFor(() => expect(pty.writes).toContain("/effort auto\r"), {
      timeout: 1000,
      interval: 20,
    });
    fireIdlePrompt(hookProcessor, "tentacle-4");

    // Paste lands.
    await vi.waitFor(
      () => {
        const count = pty.writes.filter((w) =>
          w.includes(`${BRACKETED_PASTE_START}no-duplicate prompt${BRACKETED_PASTE_END}`),
        ).length;
        expect(count).toBeGreaterThanOrEqual(1);
      },
      { timeout: 2000, interval: 20 },
    );

    // Simulate what Claude Code actually does: fires idle_prompt AFTER
    // the paste renders (TUI is sitting idle waiting for Enter). The
    // previous implementation misread this as "paste eaten, retry" and
    // re-pasted.
    fireIdlePrompt(hookProcessor, "tentacle-4");

    // Give the state machine time to (incorrectly) react to the idle
    // signal. With the fix, it ignores idle during submit wait.
    await new Promise((r) => setTimeout(r, 300));

    // Confirm the happy path: submit lands shortly after.
    fireUserPromptSubmit(hookProcessor, "tentacle-4", "no-duplicate prompt");

    // Let the state machine notice the submit and exit.
    await new Promise((r) => setTimeout(r, 200));

    // Regression assertion: exactly ONE paste sequence was written.
    const pasteCount = pty.writes.filter((w) =>
      w.includes(`${BRACKETED_PASTE_START}no-duplicate prompt${BRACKETED_PASTE_END}`),
    ).length;
    expect(pasteCount).toBe(1);
  });

  // T5: coexistence. User's existing `.claude/settings.json` defines their
  // own SessionStart hook. installHooksInDirectory must merge, not
  // overwrite — both hooks remain intact.
  it("T5: preserves user-defined hooks in existing .claude/settings.json", () => {
    const deps = createFakeDeps();
    tempDirs.push(deps.tmpDir);
    const claudeDir = join(deps.tmpDir, ".claude");
    const settingsPath = join(claudeDir, "settings.json");

    // Pre-populate user's existing hook configuration.
    const userSettings = {
      hooks: {
        SessionStart: [
          {
            matcher: "*",
            hooks: [{ type: "command", command: "echo 'user hook ran'", timeout: 5 }],
          },
        ],
      },
      someOtherUserField: { preserved: true },
    };
    require("node:fs").mkdirSync(claudeDir, { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(userSettings, null, 2), "utf8");

    const { hookProcessor } = buildWiredRuntime(deps);
    hookProcessor.installHooksInDirectory(deps.tmpDir);

    const merged = JSON.parse(readFileSync(settingsPath, "utf8")) as {
      hooks: Record<string, unknown[]>;
      someOtherUserField: { preserved: boolean };
    };

    // Unrelated user fields survive.
    expect(merged.someOtherUserField).toEqual({ preserved: true });

    // Both the user hook and our hook live under SessionStart.
    const sessionStartEntries = merged.hooks.SessionStart as Array<{
      matcher: string;
      hooks: Array<{ type: string; command: string }>;
    }>;
    expect(sessionStartEntries.length).toBeGreaterThanOrEqual(1);

    const allCommands = sessionStartEntries.flatMap((entry) => entry.hooks).map((h) => h.command);
    expect(allCommands).toContain("echo 'user hook ran'");
    expect(allCommands.some((cmd) => cmd.includes("/api/hooks/session-start"))).toBe(true);
  });

  // T6: the actual user bug. Six sessions bootstrap concurrently. All
  // six must reach user-prompt-submit without any getting stuck at
  // "pasted but not submitted". This is the regression guard.
  it("T6: six concurrent sessions all complete bootstrap", async () => {
    const deps = createFakeDeps();
    tempDirs.push(deps.tmpDir);

    // Each spawn returns a distinct FakePty.
    const ptys: FakePty[] = [];
    spawnMock.mockImplementation(() => {
      const pty = new FakePty();
      ptys.push(pty);
      return pty;
    });

    const { sessionRuntime, hookProcessor } = buildWiredRuntime(deps);

    const terminalIds = Array.from({ length: 6 }, (_, i) => `tentacle-swarm-${i}`);
    for (const id of terminalIds) {
      registerClaudeTerminal(deps.terminals, id, `prompt for ${id}`);
    }

    // Spawn all six in rapid succession.
    for (const id of terminalIds) {
      sessionRuntime.startSession(id);
    }

    expect(ptys).toHaveLength(6);
    for (const pty of ptys) {
      expect(pty.writes[0]).toBe("claude --dangerously-skip-permissions\r");
    }

    // Fire idle_prompt for all six (they all booted).
    for (const id of terminalIds) {
      fireIdlePrompt(hookProcessor, id);
    }

    // All six should emit /effort auto.
    await vi.waitFor(
      () => {
        for (const pty of ptys) {
          expect(pty.writes).toContain("/effort auto\r");
        }
      },
      { timeout: 2000, interval: 20 },
    );

    // Fire idle_prompt again for each (post-effort-auto).
    for (const id of terminalIds) {
      fireIdlePrompt(hookProcessor, id);
    }

    // All six should paste their initial prompts.
    await vi.waitFor(
      () => {
        for (const [i, pty] of ptys.entries()) {
          const expected = `${BRACKETED_PASTE_START}prompt for ${terminalIds[i]}${BRACKETED_PASTE_END}`;
          expect(pty.writes.some((w) => w.includes(expected))).toBe(true);
        }
      },
      { timeout: 3000, interval: 20 },
    );

    // All six write the submit \r.
    await vi.waitFor(
      () => {
        for (const pty of ptys) {
          expect(pty.writes.filter((w) => w === "\r").length).toBeGreaterThanOrEqual(1);
        }
      },
      { timeout: 3000, interval: 20 },
    );

    // All six get their user-prompt-submit — the "landed successfully" signal.
    for (const id of terminalIds) {
      fireUserPromptSubmit(hookProcessor, id, `prompt for ${id}`);
    }

    // Give state machines a tick to notice the submit and exit.
    await new Promise((r) => setTimeout(r, 200));

    // No session should have exceeded the max paste attempts (3).
    for (const pty of ptys) {
      const pasteCount = pty.writes.filter((w) => w.includes(BRACKETED_PASTE_START)).length;
      expect(pasteCount).toBeLessThanOrEqual(3);
      expect(pasteCount).toBeGreaterThanOrEqual(1);
    }
  });

  // T7: upgrade path. User had an older octogent install that wrote
  // type:"http" hooks; re-running installHooksInDirectory must strip
  // those and emit fresh type:"command" curl entries, without touching
  // user-authored hooks.
  it("T7: freshly regenerates octogent hooks and strips stale type:http entries on reinstall", () => {
    const deps = createFakeDeps();
    tempDirs.push(deps.tmpDir);
    const claudeDir = join(deps.tmpDir, ".claude");
    const settingsPath = join(claudeDir, "settings.json");

    const staleSettings = {
      hooks: {
        SessionStart: [
          {
            matcher: "*",
            hooks: [{ type: "command", command: "echo 'user hook'", timeout: 5 }],
          },
        ],
        PreToolUse: [
          {
            matcher: "*",
            hooks: [
              {
                type: "http",
                url: "http://old-host:9999/api/hooks/pre-tool-use",
                headers: { "X-Octogent-Session": "$OCTOGENT_SESSION_ID" },
                allowedEnvVars: ["OCTOGENT_SESSION_ID"],
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
                type: "http",
                url: "http://old-host:9999/api/code-intel/events",
                headers: { "X-Octogent-Session": "$OCTOGENT_SESSION_ID" },
                allowedEnvVars: ["OCTOGENT_SESSION_ID"],
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
                type: "http",
                url: "http://old-host:9999/api/hooks/notification",
                headers: { "X-Octogent-Session": "$OCTOGENT_SESSION_ID" },
                allowedEnvVars: ["OCTOGENT_SESSION_ID"],
                timeout: 5,
              },
            ],
          },
        ],
      },
    };
    require("node:fs").mkdirSync(claudeDir, { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(staleSettings, null, 2), "utf8");

    const { hookProcessor } = buildWiredRuntime(deps);
    hookProcessor.installHooksInDirectory(deps.tmpDir);

    const merged = JSON.parse(readFileSync(settingsPath, "utf8")) as {
      hooks: Record<
        string,
        Array<{
          matcher?: string;
          hooks: Array<{ type: string; command?: string; url?: string }>;
        }>
      >;
    };

    // No stale type:"http" entries survived anywhere.
    const allHooks = Object.values(merged.hooks).flatMap((group) =>
      group.flatMap((entry) => entry.hooks),
    );
    const httpEntries = allHooks.filter((h) => h.type === "http");
    expect(httpEntries).toEqual([]);

    // User's SessionStart hook was preserved unchanged.
    const sessionStartCommands = (merged.hooks.SessionStart ?? [])
      .flatMap((entry) => entry.hooks)
      .map((h) => h.command);
    expect(sessionStartCommands).toContain("echo 'user hook'");

    // Fresh command entries exist for each of the three converted hooks,
    // pointing at the current API base (not the stale old-host URL).
    const collectCommands = (event: string): string[] =>
      (merged.hooks[event] ?? []).flatMap((entry) => entry.hooks).map((h) => h.command ?? "");

    const preToolUseCommands = collectCommands("PreToolUse");
    expect(preToolUseCommands.some((c) => c.startsWith("curl -s -X POST"))).toBe(true);
    expect(preToolUseCommands.some((c) => c.includes("/api/hooks/pre-tool-use"))).toBe(true);
    expect(preToolUseCommands.some((c) => c.includes("old-host:9999"))).toBe(false);

    const postToolUseCommands = collectCommands("PostToolUse");
    expect(postToolUseCommands.some((c) => c.includes("/api/code-intel/events"))).toBe(true);
    expect(postToolUseCommands.some((c) => c.includes("old-host:9999"))).toBe(false);

    const notificationCommands = collectCommands("Notification");
    expect(notificationCommands.some((c) => c.includes("/api/hooks/notification"))).toBe(true);
    expect(notificationCommands.some((c) => c.includes("old-host:9999"))).toBe(false);
  });
});
