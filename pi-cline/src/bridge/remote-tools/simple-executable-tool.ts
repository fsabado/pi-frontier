import type { ToolResultMessage } from "@mariozechner/pi-ai";
import type { RemoteToolCallMeta } from "../shared/remote-tool";
import type { PiToolCapabilities, RuntimeToolName } from "../shared/tool-names";
import { BaseSemanticTool } from "./base";
import type { RemoteToolExecutionPlan } from "./types";

interface SimpleExecutableToolOptions {
  advertisedWhen: (capabilities: PiToolCapabilities) => boolean;
  runtimeToolName: RuntimeToolName;
  buildRuntimeArguments: (
    remoteArgs: Record<string, unknown>,
  ) => Record<string, unknown>;
  formatToolResult?: (
    meta: RemoteToolCallMeta,
    result: ToolResultMessage,
    cwd: string,
  ) => string;
}

export class SimpleExecutableTool extends BaseSemanticTool {
  private readonly options: SimpleExecutableToolOptions;

  constructor(id: string, options: SimpleExecutableToolOptions) {
    super(id, "executable", {
      defaultRuntimeToolNames: [options.runtimeToolName],
    });
    this.options = options;
  }

  override isAdvertised(capabilities: PiToolCapabilities): boolean {
    return this.options.advertisedWhen(capabilities);
  }

  override mapRemoteCall(
    remoteMeta: RemoteToolCallMeta,
  ): RemoteToolExecutionPlan {
    return {
      kind: "tool_call",
      runtimeToolName: this.options.runtimeToolName,
      runtimeArguments: this.options.buildRuntimeArguments(
        remoteMeta.remoteArgs,
      ),
      remoteMeta,
    };
  }

  override formatToolResult(
    meta: RemoteToolCallMeta,
    result: ToolResultMessage,
    cwd: string,
  ): string | undefined {
    return this.options.formatToolResult?.(meta, result, cwd);
  }
}
