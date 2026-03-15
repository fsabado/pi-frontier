import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { formatNoopToolResult } from "../pi-to-cline/tool-results/noop";
import { getResultText } from "../pi-to-cline/tool-results/shared";
import type { RemoteToolCallMeta } from "../shared/remote-tool";
import type { PiToolCapabilities } from "../shared/tool-names";
import { BaseSemanticTool } from "./base";
import type { RemoteToolExecutionPlan } from "./types";

interface NoopPromptAlignmentToolConfig {
  id: string;
  runtimeToolName?: string;
  buildRuntimeArguments: (
    remoteArgs: Record<string, unknown>,
  ) => Record<string, unknown>;
  syntheticResultText?: string;
}

export class NoopPromptAlignmentTool extends BaseSemanticTool {
  private readonly config: NoopPromptAlignmentToolConfig;

  constructor(config: NoopPromptAlignmentToolConfig) {
    super(config.id, "noop_prompt_alignment", {
      defaultRuntimeToolNames: [config.runtimeToolName ?? config.id],
    });
    this.config = config;
  }

  override isAdvertised(_capabilities: PiToolCapabilities): boolean {
    return false;
  }

  override mapRemoteCall(
    remoteMeta: RemoteToolCallMeta,
    capabilities: PiToolCapabilities,
  ): RemoteToolExecutionPlan {
    const runtimeToolName = this.config.runtimeToolName ?? this.id;
    const runtimeArguments = this.config.buildRuntimeArguments(
      remoteMeta.remoteArgs,
    );

    if (capabilities.activeTools.has(runtimeToolName)) {
      return {
        kind: "tool_call",
        runtimeToolName,
        runtimeArguments,
        remoteMeta,
      };
    }

    return {
      kind: "synthetic_tool_result",
      runtimeToolName,
      runtimeArguments,
      remoteMeta,
      ...(this.config.syntheticResultText !== undefined
        ? { resultText: this.config.syntheticResultText }
        : {}),
    };
  }

  override formatToolResult(
    meta: RemoteToolCallMeta,
    result: ToolResultMessage,
    _cwd: string,
  ): string {
    return formatNoopToolResult(meta, getResultText(result));
  }
}
