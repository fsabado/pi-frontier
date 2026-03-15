import type { AssistantMessage, ToolResultMessage } from "@mariozechner/pi-ai";
import type { RemoteToolCallMeta } from "../shared/remote-tool";
import type { PiToolCapabilities, RuntimeToolName } from "../shared/tool-names";

export type SemanticToolCategory =
  | "completion"
  | "display_only"
  | "executable"
  | "noop_prompt_alignment";

export interface RuntimeToolCallPlan {
  kind: "tool_call";
  runtimeToolName: RuntimeToolName;
  runtimeArguments: Record<string, unknown>;
  remoteMeta: RemoteToolCallMeta;
}

export interface SyntheticToolResultPlan {
  kind: "synthetic_tool_result";
  runtimeToolName: RuntimeToolName;
  runtimeArguments: Record<string, unknown>;
  remoteMeta: RemoteToolCallMeta;
  resultText?: string;
  isError?: boolean;
}

export type RemoteToolExecutionPlan =
  | RuntimeToolCallPlan
  | SyntheticToolResultPlan;

export interface RemoteToolCallPayload {
  remoteName: string;
  remoteArgs: Record<string, unknown>;
}

export type RuntimeToolCall = Extract<
  AssistantMessage["content"][number],
  { type: "toolCall" }
>;

export interface SemanticTool {
  id: string;
  category: SemanticToolCategory;
  defaultRuntimeToolNames: readonly string[];
  isAdvertised(capabilities: PiToolCapabilities): boolean;
  mapRemoteCall(
    remoteMeta: RemoteToolCallMeta,
    capabilities: PiToolCapabilities,
    cwd: string,
  ): RemoteToolExecutionPlan | null;
  inferRemoteArgsFromRuntimeToolCall(
    runtimeToolName: string,
    runtimeArguments: Record<string, unknown>,
  ): Record<string, unknown> | undefined;
  getDisplayText(parameters: Record<string, string>): string | undefined;
  getCompletionText(
    parameters: Record<string, string>,
    rawText: string,
  ): string | undefined;
  formatToolResult(
    meta: RemoteToolCallMeta,
    result: ToolResultMessage,
    cwd: string,
  ): string | undefined;
}
