import type { ToolResultMessage } from "@mariozechner/pi-ai";
import type { LiveEventChannel } from "../../provider/agent-stream-hook";

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\"'\"'")}'`;
}

export interface ToolExecRequest {
  toolCallId: string;
  cursorExecType: string;
  piToolName: string;
  piToolArgs: Record<string, unknown>;
}

interface PendingResult {
  resolve: (result: ToolResultMessage) => void;
  reject: (error: Error) => void;
}

const pendingResults = new Map<string, PendingResult>();

export function requestToolExecution(
  channel: LiveEventChannel | null,
  request: ToolExecRequest,
): Promise<ToolResultMessage> {
  return new Promise<ToolResultMessage>((resolve, reject) => {
    pendingResults.set(request.toolCallId, { resolve, reject });

    if (channel) {
      channel.push({
        kind: "tool-exec-request",
        request,
      });
    } else {
      pendingResults.delete(request.toolCallId);
      reject(new Error("Tool bridge not available — no active stream"));
    }
  });
}

export function resolveToolResult(result: ToolResultMessage): boolean {
  const pending = pendingResults.get(result.toolCallId);
  if (!pending) return false;
  pendingResults.delete(result.toolCallId);
  pending.resolve(result);
  return true;
}

export function rejectAllPending(reason: string): void {
  for (const [id, pending] of pendingResults) {
    pending.reject(new Error(reason));
    pendingResults.delete(id);
  }
}
