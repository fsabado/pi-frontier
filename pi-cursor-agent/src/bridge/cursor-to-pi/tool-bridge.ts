/**
 * Bridges Cursor exec requests to pi native tool execution.
 *
 * Executors publish ToolExecRequest objects and await a ToolResultMessage.
 * stream.ts emits the matching pi toolCall blocks, and tool_execution_end
 * resolves the pending promise.
 */
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import type { LiveEventChannel } from "../../provider/agent-stream-hook";

// ─── Shell quoting ──────────────────────────────────────────────────

/** Quote a string for shell use with POSIX single-quote escaping. */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\"'\"'")}'`;
}

// ─── Tool exec request ──────────────────────────────────────────────

export interface ToolExecRequest {
  toolCallId: string;
  /** pi tool name */
  piToolName: string;
  /** pi tool args */
  piToolArgs: Record<string, unknown>;
}

// ─── Pending result promises ────────────────────────────────────────

interface PendingResult {
  resolve: (result: ToolResultMessage) => void;
  reject: (error: Error) => void;
}

const pendingResults = new Map<string, PendingResult>();

/** Queue a pi tool request and await its result. */
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
      // No active stream; cannot delegate to pi.
      pendingResults.delete(request.toolCallId);
      reject(new Error("Tool bridge not available — no active stream"));
    }
  });
}

/** Resolve a pending request from tool_execution_end. */
export function resolveToolResult(result: ToolResultMessage): boolean {
  const pending = pendingResults.get(result.toolCallId);
  if (!pending) return false;
  pendingResults.delete(result.toolCallId);
  pending.resolve(result);
  return true;
}

/** Reject all pending requests. */
export function rejectAllPending(reason: string): void {
  for (const [id, pending] of pendingResults) {
    pending.reject(new Error(reason));
    pendingResults.delete(id);
  }
}
