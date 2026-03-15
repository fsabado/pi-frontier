import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { buildSearchReplaceDiff } from "../../lib/search-replace-diff";
import { mapReplaceInFileCall } from "../cline-to-pi/replace-in-file";
import { formatReplaceInFileResult } from "../pi-to-cline/tool-results/file";
import { getResultText } from "../pi-to-cline/tool-results/shared";
import type { RemoteToolCallMeta } from "../shared/remote-tool";
import type { PiToolCapabilities } from "../shared/tool-names";
import { BaseSemanticTool } from "./base";
import type { RemoteToolExecutionPlan } from "./types";

export class ReplaceInFileTool extends BaseSemanticTool {
  constructor() {
    super("replace_in_file", "executable", {
      defaultRuntimeToolNames: ["edit"],
    });
  }

  override isAdvertised(capabilities: PiToolCapabilities): boolean {
    return (
      capabilities.activeTools.has("edit") ||
      capabilities.activeTools.has("write")
    );
  }

  override mapRemoteCall(
    remoteMeta: RemoteToolCallMeta,
    capabilities: PiToolCapabilities,
    cwd: string,
  ): RemoteToolExecutionPlan {
    return mapReplaceInFileCall(remoteMeta, capabilities, cwd);
  }

  override inferRemoteArgsFromRuntimeToolCall(
    runtimeToolName: string,
    runtimeArguments: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (runtimeToolName !== "edit") {
      return undefined;
    }

    return {
      path: runtimeArguments.path,
      diff: buildSearchReplaceDiff(
        typeof runtimeArguments.oldText === "string"
          ? runtimeArguments.oldText
          : "",
        typeof runtimeArguments.newText === "string"
          ? runtimeArguments.newText
          : "",
      ),
    };
  }

  override formatToolResult(
    meta: RemoteToolCallMeta,
    result: ToolResultMessage,
    cwd: string,
  ): string {
    return formatReplaceInFileResult(meta, result, getResultText(result), cwd);
  }
}
