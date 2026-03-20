import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { RemoteToolCallMeta } from "../bridge/shared/remote-tool";

export interface StoredAssistantRawEntry {
  timestamp: number;
  rawText: string;
}

interface StoredPromptCurrentTimeEntry {
  value: string;
}

export interface ClineStateSnapshot {
  promptCurrentTime?: string;
  assistantRaw: StoredAssistantRawEntry[];
  remoteToolCalls: RemoteToolCallMeta[];
}

export interface ClineStateImportOptions {
  assistantTimestamps?: ReadonlySet<number>;
  toolCallIds?: ReadonlySet<string>;
  preferExisting?: boolean;
}

export interface ClineStateStore {
  rememberAssistantRaw(entry: StoredAssistantRawEntry): void;
  getAssistantRaw(timestamp: number | undefined): string | undefined;
  rememberRemoteToolCall(entry: RemoteToolCallMeta): void;
  getRemoteToolCall(toolCallId: string): RemoteToolCallMeta | undefined;
  getOrCreatePromptCurrentTime(createValue: () => string): string;
  exportSnapshot(): ClineStateSnapshot;
  importSnapshot(
    snapshot: ClineStateSnapshot | null | undefined,
    options?: ClineStateImportOptions,
  ): void;
  resetFromContext(ctx: ExtensionContext): void;
}

export const ASSISTANT_RAW_ENTRY_TYPE = "pi-cline:assistant-raw";
export const REMOTE_TOOL_CALL_ENTRY_TYPE = "pi-cline:remote-tool-call";
export const PROMPT_CURRENT_TIME_ENTRY_TYPE = "pi-cline:prompt-current-time";

export const isAssistantRawEntry = (
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

export const isRemoteToolCallMeta = (
  value: unknown,
): value is RemoteToolCallMeta => {
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

  const canImport = <K>(
    key: K,
    whitelist: ReadonlySet<K> | undefined,
    existing: ReadonlyMap<K, unknown>,
    preferExisting?: boolean,
  ): boolean =>
    (!whitelist || whitelist.has(key)) &&
    !(preferExisting && existing.has(key));

  return {
    rememberAssistantRaw(entry) {
      assistantRawByTimestamp.set(entry.timestamp, entry.rawText);
      appendEntry(ASSISTANT_RAW_ENTRY_TYPE, entry);
    },

    getAssistantRaw(timestamp) {
      return typeof timestamp === "number"
        ? assistantRawByTimestamp.get(timestamp)
        : undefined;
    },

    rememberRemoteToolCall(entry) {
      remoteToolCallsById.set(entry.toolCallId, entry);
      appendEntry(REMOTE_TOOL_CALL_ENTRY_TYPE, entry);
    },

    getRemoteToolCall(toolCallId) {
      return remoteToolCallsById.get(toolCallId);
    },

    getOrCreatePromptCurrentTime(createValue) {
      if (promptCurrentTime) {
        return promptCurrentTime;
      }

      promptCurrentTime = createValue();
      appendEntry(PROMPT_CURRENT_TIME_ENTRY_TYPE, { value: promptCurrentTime });
      return promptCurrentTime;
    },

    exportSnapshot() {
      return {
        ...(promptCurrentTime ? { promptCurrentTime } : {}),
        assistantRaw: [...assistantRawByTimestamp].map(
          ([timestamp, rawText]) => ({ timestamp, rawText }),
        ),
        remoteToolCalls: [...remoteToolCallsById.values()],
      };
    },

    importSnapshot(snapshot, options = {}) {
      if (!snapshot) return;

      if (
        (!promptCurrentTime || !options.preferExisting) &&
        snapshot.promptCurrentTime
      ) {
        promptCurrentTime = snapshot.promptCurrentTime;
      }

      for (const e of snapshot.assistantRaw) {
        if (
          canImport(
            e.timestamp,
            options.assistantTimestamps,
            assistantRawByTimestamp,
            options.preferExisting,
          )
        ) {
          assistantRawByTimestamp.set(e.timestamp, e.rawText);
        }
      }

      for (const e of snapshot.remoteToolCalls) {
        if (
          canImport(
            e.toolCallId,
            options.toolCallIds,
            remoteToolCallsById,
            options.preferExisting,
          )
        ) {
          remoteToolCallsById.set(e.toolCallId, e);
        }
      }
    },

    resetFromContext(ctx: ExtensionContext) {
      assistantRawByTimestamp.clear();
      remoteToolCallsById.clear();
      promptCurrentTime = undefined;

      for (const entry of ctx.sessionManager.getBranch()) {
        if (entry.type !== "custom") {
          continue;
        }

        if (entry.customType === ASSISTANT_RAW_ENTRY_TYPE) {
          if (isAssistantRawEntry(entry.data)) {
            assistantRawByTimestamp.set(
              entry.data.timestamp,
              entry.data.rawText,
            );
          }
          continue;
        }

        if (
          entry.customType === REMOTE_TOOL_CALL_ENTRY_TYPE &&
          isRemoteToolCallMeta(entry.data)
        ) {
          remoteToolCallsById.set(entry.data.toolCallId, entry.data);
          continue;
        }

        if (
          entry.customType === PROMPT_CURRENT_TIME_ENTRY_TYPE &&
          isStoredPromptCurrentTimeEntry(entry.data)
        ) {
          promptCurrentTime = entry.data.value;
        }
      }
    },
  };
}
