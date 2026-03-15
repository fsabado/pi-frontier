import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { RemoteToolCallMeta } from "../bridge/shared/remote-tool";

interface StoredAssistantRawEntry {
  timestamp: number;
  rawText: string;
}

interface StoredPromptCurrentTimeEntry {
  value: string;
}

export interface ClineStateStore {
  rememberAssistantRaw(entry: StoredAssistantRawEntry): void;
  getAssistantRaw(timestamp: number | undefined): string | undefined;
  rememberRemoteToolCall(entry: RemoteToolCallMeta): void;
  getRemoteToolCall(toolCallId: string): RemoteToolCallMeta | undefined;
  getOrCreatePromptCurrentTime(createValue: () => string): string;
  resetFromContext(ctx: ExtensionContext): void;
}

const assistantRawEntryType = "pi-cline:assistant-raw";
const remoteToolCallEntryType = "pi-cline:remote-tool-call";
const promptCurrentTimeEntryType = "pi-cline:prompt-current-time";

const isAssistantRawEntry = (
  value: unknown,
): value is StoredAssistantRawEntry => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<StoredAssistantRawEntry>;
  return (
    typeof entry.timestamp === "number" && typeof entry.rawText === "string"
  );
};

const isRemoteToolCallMeta = (value: unknown): value is RemoteToolCallMeta => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<RemoteToolCallMeta>;
  return (
    typeof entry.toolCallId === "string" &&
    entry.toolCallId.length > 0 &&
    typeof entry.remoteName === "string" &&
    !!entry.remoteArgs &&
    typeof entry.remoteArgs === "object" &&
    !Array.isArray(entry.remoteArgs) &&
    typeof entry.assistantTimestamp === "number"
  );
};

const isStoredPromptCurrentTimeEntry = (
  value: unknown,
): value is StoredPromptCurrentTimeEntry => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<StoredPromptCurrentTimeEntry>;
  return typeof entry.value === "string" && entry.value.length > 0;
};

export function createStateStore(
  appendEntry: (customType: string, data?: unknown) => void,
): ClineStateStore {
  const assistantRawByTimestamp = new Map<number, string>();
  const remoteToolCallsById = new Map<string, RemoteToolCallMeta>();
  let promptCurrentTime: string | undefined;

  return {
    rememberAssistantRaw(entry) {
      assistantRawByTimestamp.set(entry.timestamp, entry.rawText);
      appendEntry(assistantRawEntryType, entry);
    },

    getAssistantRaw(timestamp) {
      return typeof timestamp === "number"
        ? assistantRawByTimestamp.get(timestamp)
        : undefined;
    },

    rememberRemoteToolCall(entry) {
      remoteToolCallsById.set(entry.toolCallId, entry);
      appendEntry(remoteToolCallEntryType, entry);
    },

    getRemoteToolCall(toolCallId) {
      return remoteToolCallsById.get(toolCallId);
    },

    getOrCreatePromptCurrentTime(createValue) {
      if (promptCurrentTime) {
        return promptCurrentTime;
      }

      promptCurrentTime = createValue();
      appendEntry(promptCurrentTimeEntryType, { value: promptCurrentTime });
      return promptCurrentTime;
    },

    resetFromContext(ctx: ExtensionContext) {
      assistantRawByTimestamp.clear();
      remoteToolCallsById.clear();
      promptCurrentTime = undefined;

      for (const entry of ctx.sessionManager.getBranch()) {
        if (entry.type !== "custom") {
          continue;
        }

        if (entry.customType === assistantRawEntryType) {
          if (isAssistantRawEntry(entry.data)) {
            assistantRawByTimestamp.set(
              entry.data.timestamp,
              entry.data.rawText,
            );
          }
          continue;
        }

        if (
          entry.customType === remoteToolCallEntryType &&
          isRemoteToolCallMeta(entry.data)
        ) {
          remoteToolCallsById.set(entry.data.toolCallId, entry.data);
          continue;
        }

        if (
          entry.customType === promptCurrentTimeEntryType &&
          isStoredPromptCurrentTimeEntry(entry.data)
        ) {
          promptCurrentTime = entry.data.value;
        }
      }
    },
  };
}
