import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { normalizePath } from "../../lib/path";
import { formatCommandResult } from "../pi-to-cline/tool-results/command";
import {
  formatReadLikeToolResult,
  formatWriteToFileResult,
} from "../pi-to-cline/tool-results/file";
import { getResultText } from "../pi-to-cline/tool-results/shared";
import {
  buildListCodeDefinitionNamesCommand,
  buildListFilesCommand,
  buildSearchFilesCommand,
  toBooleanFlag,
} from "../shared/command-builders";
import type { RemoteToolCallMeta } from "../shared/remote-tool";
import type { PiToolCapabilities } from "../shared/tool-names";
import { CompletionTool } from "./completion-tool";
import { DisplayOnlyTool } from "./display-only-tool";
import { NoopPromptAlignmentTool } from "./noop-prompt-alignment-tool";
import { ReplaceInFileTool } from "./replace-in-file-tool";
import { SimpleExecutableTool } from "./simple-executable-tool";
import type {
  RemoteToolCallPayload,
  RemoteToolExecutionPlan,
  RuntimeToolCall,
  SemanticTool,
} from "./types";

// -----------------------------------------------------------------------------
// Semantic tool implementations used only by this registry
// -----------------------------------------------------------------------------

class ReadFileTool extends SimpleExecutableTool {
  override inferRemoteArgsFromRuntimeToolCall(
    runtimeToolName: string,
    runtimeArguments: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (runtimeToolName !== "read") {
      return undefined;
    }

    return { path: runtimeArguments.path };
  }

  override formatToolResult(
    meta: RemoteToolCallMeta,
    result: ToolResultMessage,
  ): string {
    return formatReadLikeToolResult(meta, getResultText(result));
  }
}

class WriteToFileTool extends SimpleExecutableTool {
  override inferRemoteArgsFromRuntimeToolCall(
    runtimeToolName: string,
    runtimeArguments: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (runtimeToolName !== "write") {
      return undefined;
    }

    return { path: runtimeArguments.path, content: runtimeArguments.content };
  }

  override formatToolResult(
    meta: RemoteToolCallMeta,
    result: ToolResultMessage,
    cwd: string,
  ): string {
    return formatWriteToFileResult(meta, getResultText(result), cwd);
  }
}

class ExecuteCommandTool extends SimpleExecutableTool {
  override inferRemoteArgsFromRuntimeToolCall(
    runtimeToolName: string,
    runtimeArguments: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (runtimeToolName !== "bash") {
      return undefined;
    }

    return {
      command: runtimeArguments.command,
      ...(runtimeArguments.timeout !== undefined
        ? { timeout: runtimeArguments.timeout }
        : {}),
    };
  }

  override formatToolResult(
    meta: RemoteToolCallMeta,
    result: ToolResultMessage,
  ): string {
    return formatCommandResult(meta, result, getResultText(result));
  }
}

class ReadLikeBashTool extends SimpleExecutableTool {
  override formatToolResult(
    meta: RemoteToolCallMeta,
    result: ToolResultMessage,
  ): string {
    return formatReadLikeToolResult(meta, getResultText(result));
  }
}

// -----------------------------------------------------------------------------
// Shared serialization helper
// -----------------------------------------------------------------------------

function serializeRemoteToolArguments(remoteArgs: Record<string, unknown>) {
  return Object.entries(remoteArgs)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) =>
      key === "task_progress"
        ? `<${key}>\n${String(value)}\n</${key}>`
        : `<${key}>${String(value)}</${key}>`,
    )
    .join("\n");
}

// -----------------------------------------------------------------------------
// Registry
// -----------------------------------------------------------------------------

class SemanticToolRegistry {
  private readonly toolsById = new Map<string, SemanticTool>();
  private readonly defaultRemoteNameByPiTool = new Map<string, string>();
  private readonly tools: SemanticTool[] = [];

  register(tool: SemanticTool): void {
    if (this.toolsById.has(tool.id)) {
      throw new Error(`Duplicate semantic tool id: ${tool.id}`);
    }

    this.tools.push(tool);
    this.toolsById.set(tool.id, tool);

    for (const runtimeToolName of tool.defaultRuntimeToolNames) {
      if (!this.defaultRemoteNameByPiTool.has(runtimeToolName)) {
        this.defaultRemoteNameByPiTool.set(runtimeToolName, tool.id);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Prompt / policy queries
  // ---------------------------------------------------------------------------

  getAdvertisedToolIds(capabilities: PiToolCapabilities): string[] {
    return this.tools
      .filter((tool) => tool.isAdvertised(capabilities))
      .map((tool) => tool.id);
  }

  inferDefaultRemoteToolName(runtimeToolName: string): string | undefined {
    return this.defaultRemoteNameByPiTool.get(runtimeToolName);
  }

  isDisplayOnlyTool(id: string): boolean {
    return this.toolsById.get(id)?.category === "display_only";
  }

  isNoopPromptAlignmentTool(id: string): boolean {
    return this.toolsById.get(id)?.category === "noop_prompt_alignment";
  }

  isExecutableOrDisplayTool(id: string): boolean {
    const category = this.toolsById.get(id)?.category;
    return category === "display_only" || category === "executable";
  }

  getDisplayText(
    id: string,
    parameters: Record<string, string>,
  ): string | undefined {
    return this.toolsById.get(id)?.getDisplayText(parameters);
  }

  getCompletionText(
    id: string,
    parameters: Record<string, string>,
    rawText: string,
  ): string | undefined {
    return this.toolsById.get(id)?.getCompletionText(parameters, rawText);
  }

  // ---------------------------------------------------------------------------
  // cline -> pi bridge
  // ---------------------------------------------------------------------------

  mapRemoteToolCall(
    remoteMeta: RemoteToolCallMeta,
    capabilities: PiToolCapabilities,
    cwd: string,
  ): RemoteToolExecutionPlan | null {
    return (
      this.toolsById
        .get(remoteMeta.remoteName)
        ?.mapRemoteCall(remoteMeta, capabilities, cwd) ?? null
    );
  }

  // ---------------------------------------------------------------------------
  // pi -> cline bridge
  // ---------------------------------------------------------------------------

  buildRemoteToolCallFromRuntimeToolCall(
    toolCall: RuntimeToolCall,
    meta: RemoteToolCallMeta | undefined,
  ): RemoteToolCallPayload {
    if (meta) {
      return {
        remoteName: meta.remoteName,
        remoteArgs: meta.remoteArgs,
      };
    }

    const remoteName =
      this.inferDefaultRemoteToolName(toolCall.name) || toolCall.name;
    const remoteArgs =
      this.toolsById
        .get(remoteName)
        ?.inferRemoteArgsFromRuntimeToolCall(
          toolCall.name,
          toolCall.arguments,
        ) ?? toolCall.arguments;

    return { remoteName, remoteArgs };
  }

  serializeRemoteToolCallToXml(
    remoteName: string,
    remoteArgs: Record<string, unknown>,
  ): string {
    const serializedArguments = serializeRemoteToolArguments(remoteArgs);
    return serializedArguments
      ? `<${remoteName}>\n${serializedArguments}\n</${remoteName}>`
      : `<${remoteName}>\n</${remoteName}>`;
  }

  formatToolResult(
    meta: RemoteToolCallMeta,
    result: ToolResultMessage,
    cwd: string,
  ): string | undefined {
    return this.toolsById
      .get(meta.remoteName)
      ?.formatToolResult(meta, result, cwd);
  }
}

// -----------------------------------------------------------------------------
// Registry construction
// -----------------------------------------------------------------------------

function createSemanticToolRegistry() {
  const registry = new SemanticToolRegistry();

  // ---------------------------------------------------------------------------
  // File tools
  // ---------------------------------------------------------------------------

  registry.register(
    new ReadFileTool("read_file", {
      advertisedWhen: (capabilities) => capabilities.activeTools.has("read"),
      runtimeToolName: "read",
      buildRuntimeArguments: (remoteArgs) => ({
        path: normalizePath(remoteArgs.path),
      }),
    }),
  );

  registry.register(
    new WriteToFileTool("write_to_file", {
      advertisedWhen: (capabilities) => capabilities.activeTools.has("write"),
      runtimeToolName: "write",
      buildRuntimeArguments: (remoteArgs) => ({
        path: normalizePath(remoteArgs.path),
        content:
          typeof remoteArgs.content === "string" ? remoteArgs.content : "",
      }),
    }),
  );

  registry.register(new ReplaceInFileTool());

  // ---------------------------------------------------------------------------
  // Command / bash-backed tools
  // ---------------------------------------------------------------------------

  registry.register(
    new ExecuteCommandTool("execute_command", {
      advertisedWhen: (capabilities) => capabilities.activeTools.has("bash"),
      runtimeToolName: "bash",
      buildRuntimeArguments: (remoteArgs) => ({
        command:
          typeof remoteArgs.command === "string" ? remoteArgs.command : "",
        ...(typeof remoteArgs.timeout === "string"
          ? { timeout: Number.parseInt(remoteArgs.timeout, 10) }
          : typeof remoteArgs.timeout === "number"
            ? { timeout: remoteArgs.timeout }
            : {}),
      }),
    }),
  );

  registry.register(
    new ReadLikeBashTool("list_files", {
      advertisedWhen: (capabilities) => capabilities.activeTools.has("bash"),
      runtimeToolName: "bash",
      buildRuntimeArguments: (remoteArgs) => ({
        command: buildListFilesCommand(
          normalizePath(remoteArgs.path),
          toBooleanFlag(remoteArgs.recursive),
        ),
      }),
    }),
  );

  registry.register(
    new ReadLikeBashTool("list_code_definition_names", {
      advertisedWhen: (capabilities) => capabilities.activeTools.has("bash"),
      runtimeToolName: "bash",
      buildRuntimeArguments: (remoteArgs) => ({
        command: buildListCodeDefinitionNamesCommand(
          normalizePath(remoteArgs.path),
        ),
      }),
    }),
  );

  registry.register(
    new ReadLikeBashTool("search_files", {
      advertisedWhen: (capabilities) => capabilities.activeTools.has("bash"),
      runtimeToolName: "bash",
      buildRuntimeArguments: (remoteArgs) => ({
        command: buildSearchFilesCommand(
          normalizePath(remoteArgs.path),
          typeof remoteArgs.regex === "string" ? remoteArgs.regex : "",
          typeof remoteArgs.file_pattern === "string"
            ? remoteArgs.file_pattern
            : undefined,
        ),
      }),
    }),
  );

  // ---------------------------------------------------------------------------
  // Response-only tools
  // ---------------------------------------------------------------------------

  registry.register(new CompletionTool("attempt_completion"));
  registry.register(new DisplayOnlyTool("act_mode_respond", "response"));
  registry.register(new DisplayOnlyTool("ask_followup_question", "question"));
  registry.register(new DisplayOnlyTool("plan_mode_respond", "response"));

  // ---------------------------------------------------------------------------
  // Prompt-alignment tools with runtime passthrough or synthetic fallback
  // ---------------------------------------------------------------------------

  registry.register(
    new NoopPromptAlignmentTool({
      id: "access_mcp_resource",
      buildRuntimeArguments: (remoteArgs) => ({
        server_name: remoteArgs.server_name,
        uri: remoteArgs.uri,
        task_progress: remoteArgs.task_progress,
      }),
    }),
  );

  registry.register(
    new NoopPromptAlignmentTool({
      id: "browser_action",
      buildRuntimeArguments: (remoteArgs) => ({
        action: remoteArgs.action,
        url: remoteArgs.url,
        coordinate: remoteArgs.coordinate,
        text: remoteArgs.text,
        task_progress: remoteArgs.task_progress,
      }),
    }),
  );

  registry.register(
    new NoopPromptAlignmentTool({
      id: "load_mcp_documentation",
      buildRuntimeArguments: () => ({}),
    }),
  );

  registry.register(
    new NoopPromptAlignmentTool({
      id: "new_task",
      buildRuntimeArguments: (remoteArgs) => ({ context: remoteArgs.context }),
    }),
  );

  registry.register(
    new NoopPromptAlignmentTool({
      id: "use_mcp_tool",
      buildRuntimeArguments: (remoteArgs) => ({
        server_name: remoteArgs.server_name,
        tool_name: remoteArgs.tool_name,
        arguments: remoteArgs.arguments,
        task_progress: remoteArgs.task_progress,
      }),
    }),
  );

  registry.register(
    new NoopPromptAlignmentTool({
      id: "web_fetch",
      buildRuntimeArguments: (remoteArgs) => ({
        url: remoteArgs.url,
        task_progress: remoteArgs.task_progress,
      }),
    }),
  );

  registry.register(
    new NoopPromptAlignmentTool({
      id: "web_search",
      buildRuntimeArguments: (remoteArgs) => ({
        query: remoteArgs.query,
        task_progress: remoteArgs.task_progress,
      }),
    }),
  );

  return registry;
}

export const semanticToolRegistry = createSemanticToolRegistry();
