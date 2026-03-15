import type { RemoteToolCallMeta } from "../../shared/remote-tool";

export function formatNoopToolResult(
  meta: RemoteToolCallMeta,
  resultText: string,
) {
  return `[${meta.remoteName}] Result:\n${resultText || "The operation completed successfully."}`;
}
