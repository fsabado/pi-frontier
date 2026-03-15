import type { ToolResultMessage } from "@mariozechner/pi-ai";
import type { RemoteToolCallMeta } from "../../shared/remote-tool";

export function formatCommandResult(
  meta: RemoteToolCallMeta,
  result: ToolResultMessage,
  resultText: string,
) {
  const command =
    typeof meta.remoteArgs.command === "string" ? meta.remoteArgs.command : "";
  const output = resultText || "(no output)";

  return [
    `[execute_command for '${command}'] Result:`,
    result.isError
      ? "Command executed with errors."
      : "Command executed successfully (exit code 0).",
    "Output:",
    output,
  ].join("\n");
}
