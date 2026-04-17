import { logVerbose } from "../logging";
import type { ChannelMessage, PersistedTerminal, TerminalSession } from "./types";

export const createChannelMessaging = (deps: {
  terminals: Map<string, PersistedTerminal>;
  sessions: Map<string, TerminalSession>;
  writeInput: (terminalId: string, data: string) => boolean;
}) => {
  const { terminals, sessions, writeInput } = deps;
  const channelQueues = new Map<string, ChannelMessage[]>();
  let channelMessageCounter = 0;

  const BRACKETED_PASTE_START = "\x1b[200~";
  const BRACKETED_PASTE_END = "\x1b[201~";
  // Matches sessionRuntime.ts INITIAL_PROMPT_SUBMIT_DELAY_MS. Claude Code's
  // multi-line paste UI stages the buffer and needs a deliberate Enter a
  // moment later to register as submit; a trailing `\r` in the same write
  // is eaten as a newline inside the paste.
  const CHANNEL_SUBMIT_DELAY_MS = 2_000;

  const deliverChannelMessages = (terminalId: string): void => {
    const queue = channelQueues.get(terminalId);
    if (!queue || queue.length === 0) {
      return;
    }

    const session = sessions.get(terminalId);
    if (!session) {
      return;
    }

    const undelivered = queue.filter((m) => !m.delivered);
    if (undelivered.length === 0) {
      return;
    }

    // Compose all pending messages into a single prompt injection.
    const lines = undelivered.map(
      (m) => `[Channel message from ${m.fromTerminalId}]: ${m.content}`,
    );
    const text = lines.join("\n");

    logVerbose(`[Channel] Delivering ${undelivered.length} message(s) to ${terminalId}`);

    for (const m of undelivered) {
      m.delivered = true;
    }

    const terminal = terminals.get(terminalId);
    const useBracketedPaste = (terminal?.agentProvider ?? "claude-code") === "claude-code";

    if (useBracketedPaste) {
      writeInput(terminalId, `${BRACKETED_PASTE_START}${text}${BRACKETED_PASTE_END}`);
      setTimeout(() => {
        writeInput(terminalId, "\r");
      }, CHANNEL_SUBMIT_DELAY_MS);
    } else {
      writeInput(terminalId, `${text}\r`);
    }
  };

  return {
    sendChannelMessage(
      toTerminalId: string,
      fromTerminalId: string,
      content: string,
    ): ChannelMessage | null {
      if (!terminals.has(toTerminalId)) {
        return null;
      }

      channelMessageCounter += 1;
      const message: ChannelMessage = {
        messageId: `msg-${channelMessageCounter}`,
        fromTerminalId,
        toTerminalId,
        content,
        timestamp: new Date().toISOString(),
        delivered: false,
      };

      const queue = channelQueues.get(toTerminalId) ?? [];
      queue.push(message);
      channelQueues.set(toTerminalId, queue);

      logVerbose(
        `[Channel] Queued message ${message.messageId} from=${fromTerminalId} to=${toTerminalId}`,
      );

      // If the target session is idle, deliver immediately.
      const targetSession = sessions.get(toTerminalId);
      if (targetSession && targetSession.agentState === "idle") {
        deliverChannelMessages(toTerminalId);
      }

      return message;
    },

    listChannelMessages(terminalId: string): ChannelMessage[] {
      return channelQueues.get(terminalId) ?? [];
    },

    deliverChannelMessages,
  };
};
