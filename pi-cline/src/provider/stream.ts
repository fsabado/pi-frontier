import {
  type Api,
  type AssistantMessage,
  type AssistantMessageEventStream,
  type Context,
  createAssistantMessageEventStream,
  type Message,
  type Model,
  type SimpleStreamOptions,
  type ToolResultMessage,
} from "@mariozechner/pi-ai";
import {
  type ClineChatTransport,
  defaultClineChatTransport,
} from "../api/cline-chat";
import {
  emitResolvedAssistantResponse,
  initAssistantMessage,
  resolveParsedAssistantResponse,
  updateUsage,
} from "../bridge/cline-to-pi/assistant-output";
import { parseAssistantXmlResponse } from "../bridge/cline-to-pi/xml";
import { collectPromptRuntimeInfo } from "../bridge/pi-to-cline/prompt/runtime-info";
import {
  buildClineRequestBody,
  buildClineRequestHeaders,
} from "../bridge/pi-to-cline/request-body";
import type { SyntheticToolResultPlan } from "../bridge/remote-tools/types";
import type { PiToolCapabilities } from "../bridge/shared/tool-names";
import { createRequestAbortContext } from "../lib/abort";
import { CLINE_REQUEST_TIMEOUT_MS } from "../lib/env";
import type { ClineStateStore } from "./state";

interface StreamDependencies {
  getCwd(): string;
  state: ClineStateStore;
  transport?: ClineChatTransport;
}

const hasToolResultHistory = (messages: Message[]) =>
  messages.some((message) => message.role === "toolResult");

function createOverlayState(baseState: ClineStateStore): ClineStateStore {
  const assistantRawByTimestamp = new Map<number, string>();
  const remoteToolCallsById = new Map<
    string,
    ReturnType<typeof baseState.getRemoteToolCall>
  >();

  return {
    rememberAssistantRaw(entry) {
      assistantRawByTimestamp.set(entry.timestamp, entry.rawText);
    },

    getAssistantRaw(timestamp) {
      if (typeof timestamp !== "number") {
        return undefined;
      }

      return (
        assistantRawByTimestamp.get(timestamp) ??
        baseState.getAssistantRaw(timestamp)
      );
    },

    rememberRemoteToolCall(entry) {
      remoteToolCallsById.set(entry.toolCallId, entry);
    },

    getRemoteToolCall(toolCallId) {
      return (
        remoteToolCallsById.get(toolCallId) ??
        baseState.getRemoteToolCall(toolCallId)
      );
    },

    getOrCreatePromptCurrentTime(createValue) {
      return baseState.getOrCreatePromptCurrentTime(createValue);
    },

    resetFromContext() {},
  };
}

function buildSyntheticAssistantMessage(
  model: Model<Api>,
  plan: SyntheticToolResultPlan,
): AssistantMessage {
  const assistant = initAssistantMessage(model);
  assistant.content.push({
    type: "toolCall",
    id: plan.remoteMeta.toolCallId,
    name: plan.runtimeToolName,
    arguments: plan.runtimeArguments,
  });
  return assistant;
}

function buildSyntheticToolResult(
  plan: SyntheticToolResultPlan,
): ToolResultMessage {
  return {
    role: "toolResult",
    toolCallId: plan.remoteMeta.toolCallId,
    toolName: plan.runtimeToolName,
    content: [
      {
        type: "text",
        text: plan.resultText ?? "",
      },
    ],
    isError: plan.isError === true,
    timestamp: Date.now(),
  };
}

export function streamCline(
  deps: StreamDependencies,
  model: Model<Api>,
  context: Context,
  options?: SimpleStreamOptions,
): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();

  void (async () => {
    const output = initAssistantMessage(model);
    const abort = createRequestAbortContext(
      options?.signal,
      CLINE_REQUEST_TIMEOUT_MS,
    );
    const transport = deps.transport ?? defaultClineChatTransport;

    try {
      const apiKey = options?.apiKey;
      if (!apiKey) {
        throw new Error("No Cline access token found. Log in to Cline in pi.");
      }

      const capabilities: PiToolCapabilities = {
        activeTools: new Set((context.tools || []).map((tool) => tool.name)),
      };
      const cwd = deps.getCwd();
      const runtimeInfo = collectPromptRuntimeInfo(cwd);
      const isMultiRoot =
        Object.keys(runtimeInfo.workspaceConfiguration.workspaces).length > 1;
      const headers = buildClineRequestHeaders(
        options?.sessionId || "",
        isMultiRoot,
      );
      const overlayState = createOverlayState(deps.state);
      const localContext: Context = {
        ...context,
        messages: [...context.messages],
      };

      stream.push({ type: "start", partial: output });

      while (true) {
        const body = buildClineRequestBody(
          model,
          localContext,
          cwd,
          overlayState,
          capabilities,
          runtimeInfo,
        );

        const response = await transport.createChatCompletionStream({
          apiKey,
          headers,
          body,
          signal: abort.signal,
        });

        let rawAssistantText = "";
        let finishReason: string | null = null;
        let latestUsage: typeof output.usage | undefined;

        for await (const chunk of response) {
          if (chunk.error) {
            throw new Error(
              `${chunk.error.code || "cline_error"}: ${chunk.error.message || "Unknown Cline error"}`,
            );
          }

          if (chunk.usage) {
            updateUsage(output, chunk.usage);
            latestUsage = output.usage;
          }

          const choice = chunk.choices[0];
          if (!choice) {
            continue;
          }

          if (choice.finish_reason === "error") {
            throw new Error(
              `${choice.error?.code || "cline_error"}: ${choice.error?.message || "Cline stream terminated with an error"}`,
            );
          }

          if (choice.finish_reason) {
            finishReason = choice.finish_reason;
          }

          if (choice.delta.content) {
            rawAssistantText += choice.delta.content;
          }
        }

        if (latestUsage) {
          output.usage = latestUsage;
        }

        const parsedResponse = parseAssistantXmlResponse(rawAssistantText);
        const resolved = resolveParsedAssistantResponse(
          output.timestamp,
          parsedResponse,
          capabilities,
          deps.getCwd(),
        );

        if (resolved.kind === "synthetic_tool_result") {
          overlayState.rememberRemoteToolCall(resolved.plan.remoteMeta);
          localContext.messages.push(
            buildSyntheticAssistantMessage(model, resolved.plan),
          );
          localContext.messages.push(buildSyntheticToolResult(resolved.plan));
          continue;
        }

        const emission = emitResolvedAssistantResponse(
          stream,
          output,
          resolved,
          deps.state,
        );

        deps.state.rememberAssistantRaw({
          timestamp: output.timestamp,
          rawText: emission.normalizedRawText,
        });

        if (emission.completionText) {
          const text = emission.completionText;
          output.content.push({ type: "text", text });
          const contentIndex = output.content.length - 1;
          stream.push({ type: "text_start", contentIndex, partial: output });
          stream.push({
            type: "text_delta",
            contentIndex,
            delta: text,
            partial: output,
          });
          stream.push({
            type: "text_end",
            contentIndex,
            content: text,
            partial: output,
          });
          output.stopReason = "stop";
        } else if (
          emission.usedTool ||
          hasToolResultHistory(localContext.messages)
        ) {
          output.stopReason = "toolUse";
        } else if (finishReason === "length") {
          output.stopReason = "length";
        } else {
          output.stopReason = "stop";
        }

        stream.push({
          type: "done",
          reason: output.stopReason,
          message: output,
        });
        break;
      }
    } catch (error) {
      output.stopReason = abort.wasAborted() ? "aborted" : "error";
      output.errorMessage =
        error instanceof Error ? error.message : String(error);
      stream.push({
        type: "error",
        reason: output.stopReason,
        error: output,
      });
    } finally {
      abort.cleanup();
      stream.end();
    }
  })();

  return stream;
}
