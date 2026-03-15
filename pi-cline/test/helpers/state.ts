import type { Model } from "@mariozechner/pi-ai";
import type { RemoteToolCallMeta } from "../../src/bridge/shared/remote-tool";
import type { ClineStateStore } from "../../src/provider/state";

export function createMockState(
  overrides: {
    assistantRawByTimestamp?: Map<number, string>;
    remoteToolCallsById?: Map<string, RemoteToolCallMeta>;
    promptCurrentTime?: string;
  } = {},
): ClineStateStore {
  const assistantRawByTimestamp =
    overrides.assistantRawByTimestamp || new Map();
  const remoteToolCallsById = overrides.remoteToolCallsById || new Map();
  let promptCurrentTime = overrides.promptCurrentTime;

  return {
    rememberAssistantRaw(entry) {
      assistantRawByTimestamp.set(entry.timestamp, entry.rawText);
    },
    getAssistantRaw(timestamp) {
      return typeof timestamp === "number"
        ? assistantRawByTimestamp.get(timestamp)
        : undefined;
    },
    rememberRemoteToolCall(entry) {
      remoteToolCallsById.set(entry.toolCallId, entry);
    },
    getRemoteToolCall(toolCallId) {
      return remoteToolCallsById.get(toolCallId);
    },
    getOrCreatePromptCurrentTime(createValue) {
      if (!promptCurrentTime) {
        promptCurrentTime = createValue();
      }
      return promptCurrentTime;
    },
    resetFromContext() {},
  };
}

export function createMockModel(id: string): Model<"cline-chat-completions"> {
  return {
    id,
    name: id,
    provider: "cline",
    api: "cline-chat-completions",
    baseUrl: "https://api.cline.bot/api/v1",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 16_384,
  };
}
