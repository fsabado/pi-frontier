import type { ToolResultMessage } from "@mariozechner/pi-ai";
import type { RemoteToolCallMeta } from "../shared/remote-tool";
import type { PiToolCapabilities } from "../shared/tool-names";
import type {
  RemoteToolExecutionPlan,
  SemanticTool,
  SemanticToolCategory,
} from "./types";

export abstract class BaseSemanticTool implements SemanticTool {
  readonly id: string;
  readonly category: SemanticToolCategory;
  readonly defaultRuntimeToolNames: readonly string[];

  constructor(
    id: string,
    category: SemanticToolCategory,
    options: {
      defaultRuntimeToolNames?: readonly string[];
    } = {},
  ) {
    this.id = id;
    this.category = category;
    this.defaultRuntimeToolNames = options.defaultRuntimeToolNames ?? [];
  }

  isAdvertised(_capabilities: PiToolCapabilities): boolean {
    return false;
  }

  mapRemoteCall(
    _remoteMeta: RemoteToolCallMeta,
    _capabilities: PiToolCapabilities,
    _cwd: string,
  ): RemoteToolExecutionPlan | null {
    return null;
  }

  inferRemoteArgsFromRuntimeToolCall(
    runtimeToolName: string,
    runtimeArguments: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    return this.defaultRuntimeToolNames.includes(runtimeToolName)
      ? runtimeArguments
      : undefined;
  }

  getDisplayText(_parameters: Record<string, string>): string | undefined {
    return undefined;
  }

  getCompletionText(
    _parameters: Record<string, string>,
    _rawText: string,
  ): string | undefined {
    return undefined;
  }

  formatToolResult(
    _meta: RemoteToolCallMeta,
    _result: ToolResultMessage,
    _cwd: string,
  ): string | undefined {
    return undefined;
  }
}
