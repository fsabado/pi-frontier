import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { semanticToolRegistry } from "../remote-tools";
import type { RemoteToolCallMeta } from "../shared/remote-tool";
import { getResultText } from "./tool-results/shared";

export function formatToolResultForCline(
  meta: RemoteToolCallMeta | undefined,
  result: ToolResultMessage,
  cwd: string,
) {
  const resultText = getResultText(result);
  if (!meta) {
    return resultText;
  }

  return semanticToolRegistry.formatToolResult(meta, result, cwd) ?? resultText;
}
