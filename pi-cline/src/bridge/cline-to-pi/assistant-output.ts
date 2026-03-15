import type {
  Api,
  AssistantMessage,
  AssistantMessageEventStream,
  Model,
} from "@mariozechner/pi-ai";
import type { ClineChatCompletionChunk } from "../../api/cline-chat";
import type { ClineStateStore } from "../../provider/state";
import { serializeRemoteToolCallToXml } from "../pi-to-cline/serialize-tool-call";
import { semanticToolRegistry } from "../remote-tools";
import type {
  RuntimeToolCallPlan,
  SyntheticToolResultPlan,
} from "../remote-tools/types";
import type { PiToolCapabilities } from "../shared/tool-names";
import { mapRemoteToolCall } from "./map-tool-call";
import type { ParsedAssistantResponse } from "./xml";

export function initAssistantMessage(model: Model<Api>): AssistantMessage {
  return {
    role: "assistant",
    content: [],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp: Date.now(),
  };
}

export function updateUsage(
  output: AssistantMessage,
  usage: ClineChatCompletionChunk["usage"],
) {
  const cacheRead = usage?.prompt_tokens_details?.cached_tokens || 0;
  const input = Math.max(0, (usage?.prompt_tokens || 0) - cacheRead);
  const outputTokens = usage?.completion_tokens || 0;

  output.usage = {
    input,
    output: outputTokens,
    cacheRead,
    cacheWrite: 0,
    totalTokens: input + outputTokens + cacheRead,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

function pushStreamEvents(
  stream: AssistantMessageEventStream,
  message: AssistantMessage,
  kind: "text" | "thinking",
  value: string,
) {
  const contentIndex = message.content.length - 1;
  const partial = message;

  stream.push({ type: `${kind}_start`, contentIndex, partial });
  stream.push({ type: `${kind}_delta`, contentIndex, delta: value, partial });
  stream.push({ type: `${kind}_end`, contentIndex, content: value, partial });
}

function emitThinking(
  stream: AssistantMessageEventStream,
  message: AssistantMessage,
  thinking: string,
) {
  message.content.push({
    type: "thinking",
    thinking,
    thinkingSignature: "cline-thinking",
  });
  pushStreamEvents(stream, message, "thinking", thinking);
}

function emitText(
  stream: AssistantMessageEventStream,
  message: AssistantMessage,
  text: string,
) {
  message.content.push({ type: "text", text });
  pushStreamEvents(stream, message, "text", text);
}

function buildNormalizedAssistantRaw(params: {
  thinking: string[];
  preambleText: string;
  toolCall?: { name: string; parameters: Record<string, string> };
}) {
  const parts: string[] = [];

  for (const thinking of params.thinking) {
    parts.push(`<thinking>\n${thinking}\n</thinking>`);
  }

  if (params.preambleText.trim()) {
    parts.push(params.preambleText.trim());
  }

  if (params.toolCall) {
    parts.push(
      serializeRemoteToolCallToXml(
        params.toolCall.name,
        params.toolCall.parameters,
      ),
    );
  }

  return parts.join("\n\n").trim();
}

function getDisplayTextForToolCall(toolCall: {
  name: string;
  parameters: Record<string, string>;
}) {
  return semanticToolRegistry.getDisplayText(
    toolCall.name,
    toolCall.parameters,
  );
}

function hasLaterExecutableOrDisplayTool(
  toolCalls: ParsedAssistantResponse["toolCalls"],
  currentIndex: number,
) {
  return toolCalls.slice(currentIndex + 1).some((toolCall) => {
    return (
      semanticToolRegistry.isExecutableOrDisplayTool(toolCall.name) ||
      Boolean(
        semanticToolRegistry.getCompletionText(
          toolCall.name,
          toolCall.parameters,
          "",
        ),
      )
    );
  });
}

type ResolvedAssistantResponse =
  | {
      kind: "completion";
      thinking: string[];
      completionText: string;
      normalizedRawText: string;
    }
  | {
      kind: "display";
      thinking: string[];
      preambleText: string;
      displayText: string;
      normalizedRawText: string;
    }
  | {
      kind: "tool_call";
      thinking: string[];
      preambleText: string;
      plan: RuntimeToolCallPlan;
      normalizedRawText: string;
    }
  | {
      kind: "synthetic_tool_result";
      thinking: string[];
      preambleText: string;
      plan: SyntheticToolResultPlan;
      normalizedRawText: string;
    }
  | {
      kind: "text";
      thinking: string[];
      preambleText: string;
      normalizedRawText: string;
    };

function emitRuntimeToolCall(
  stream: AssistantMessageEventStream,
  message: AssistantMessage,
  plan: RuntimeToolCallPlan,
  state: ClineStateStore,
) {
  state.rememberRemoteToolCall(plan.remoteMeta);
  message.content.push({
    type: "toolCall",
    id: plan.remoteMeta.toolCallId,
    name: plan.runtimeToolName,
    arguments: plan.runtimeArguments,
  });

  const contentIndex = message.content.length - 1;
  stream.push({ type: "toolcall_start", contentIndex, partial: message });
  stream.push({
    type: "toolcall_delta",
    contentIndex,
    delta: JSON.stringify(plan.runtimeArguments),
    partial: message,
  });
  stream.push({
    type: "toolcall_end",
    contentIndex,
    toolCall: message.content[contentIndex] as Extract<
      AssistantMessage["content"][number],
      { type: "toolCall" }
    >,
    partial: message,
  });
}

export function resolveParsedAssistantResponse(
  assistantTimestamp: number,
  parsed: ParsedAssistantResponse,
  capabilities: PiToolCapabilities,
  cwd: string,
): ResolvedAssistantResponse {
  const preambleText = parsed.preambleText.trim();

  for (const [toolCallIndex, toolCall] of parsed.toolCalls.entries()) {
    const completionText = semanticToolRegistry.getCompletionText(
      toolCall.name,
      toolCall.parameters,
      parsed.rawText,
    );
    if (completionText) {
      return {
        kind: "completion",
        thinking: parsed.thinking,
        completionText,
        normalizedRawText: buildNormalizedAssistantRaw({
          thinking: parsed.thinking,
          preambleText,
          toolCall,
        }),
      };
    }

    const displayText = getDisplayTextForToolCall(toolCall);
    if (displayText?.trim()) {
      return {
        kind: "display",
        thinking: parsed.thinking,
        preambleText,
        displayText: displayText.trim(),
        normalizedRawText: buildNormalizedAssistantRaw({
          thinking: parsed.thinking,
          preambleText: [preambleText, displayText.trim()]
            .filter(Boolean)
            .join("\n\n"),
        }),
      };
    }

    if (
      semanticToolRegistry.isNoopPromptAlignmentTool(toolCall.name) &&
      hasLaterExecutableOrDisplayTool(parsed.toolCalls, toolCallIndex)
    ) {
      continue;
    }

    const plan = mapRemoteToolCall(
      assistantTimestamp,
      crypto.randomUUID(),
      toolCall.name,
      { ...toolCall.parameters },
      capabilities,
      cwd,
    );
    if (!plan) {
      continue;
    }

    const normalizedRawText = buildNormalizedAssistantRaw({
      thinking: parsed.thinking,
      preambleText,
      toolCall,
    });

    if (plan.kind === "tool_call") {
      return {
        kind: "tool_call",
        thinking: parsed.thinking,
        preambleText,
        plan,
        normalizedRawText,
      };
    }

    return {
      kind: "synthetic_tool_result",
      thinking: parsed.thinking,
      preambleText,
      plan,
      normalizedRawText,
    };
  }

  return {
    kind: "text",
    thinking: parsed.thinking,
    preambleText,
    normalizedRawText: buildNormalizedAssistantRaw({
      thinking: parsed.thinking,
      preambleText,
    }),
  };
}

export function emitResolvedAssistantResponse(
  stream: AssistantMessageEventStream,
  message: AssistantMessage,
  resolved: Exclude<
    ResolvedAssistantResponse,
    { kind: "synthetic_tool_result" }
  >,
  state: ClineStateStore,
): {
  usedTool: boolean;
  completionText?: string;
  normalizedRawText: string;
} {
  for (const thinking of resolved.thinking) {
    emitThinking(stream, message, thinking);
  }

  switch (resolved.kind) {
    case "completion":
      return {
        usedTool: false,
        completionText: resolved.completionText,
        normalizedRawText: resolved.normalizedRawText,
      };

    case "display":
      if (resolved.preambleText) {
        emitText(stream, message, resolved.preambleText);
      }
      emitText(stream, message, resolved.displayText);
      return {
        usedTool: false,
        normalizedRawText: resolved.normalizedRawText,
      };

    case "tool_call":
      if (resolved.preambleText) {
        emitText(stream, message, resolved.preambleText);
      }
      emitRuntimeToolCall(stream, message, resolved.plan, state);
      return {
        usedTool: true,
        normalizedRawText: resolved.normalizedRawText,
      };

    case "text":
      if (resolved.preambleText) {
        emitText(stream, message, resolved.preambleText);
      }
      return {
        usedTool: false,
        normalizedRawText: resolved.normalizedRawText,
      };
  }
}
