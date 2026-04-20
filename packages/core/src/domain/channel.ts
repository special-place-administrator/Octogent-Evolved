/** A message sent between terminals over the inter-agent channel. */
export type ChannelMessage = {
  messageId: string;
  fromTerminalId: string;
  toTerminalId: string;
  content: string;
  timestamp: string;
  /** True once the server has confirmed the target terminal received the message. */
  delivered: boolean;
};
