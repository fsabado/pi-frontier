import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

export interface PiToolContext {
  readonly cwd: string;
  readonly signal?: AbortSignal;
  getActiveTools(): Set<string>;
  getCtx(): ExtensionContext | null;
  getChannel?():
    | import("../../../provider/agent-stream-hook").LiveEventChannel
    | null;
}

export function decodeToolCallId(toolCallId: string | undefined): string {
  return toolCallId && toolCallId.length > 0 ? toolCallId : crypto.randomUUID();
}
