import fs from "node:fs/promises";
import path from "node:path";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { PI_CLINE_CACHE_DIR } from "../lib/env";
import {
  ASSISTANT_RAW_ENTRY_TYPE,
  type ClineStateImportOptions,
  type ClineStateSnapshot,
  isAssistantRawEntry,
  isRemoteToolCallMeta,
  REMOTE_TOOL_CALL_ENTRY_TYPE,
} from "./state";

interface PersistedState extends ClineStateSnapshot {
  version: 1;
  sessionId: string;
  updatedAt: string;
}

const statePath = (id: string) =>
  path.join(PI_CLINE_CACHE_DIR, "chats", id, "state.json");

const isPersistedState = (v: unknown): v is PersistedState => {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    s.version === 1 &&
    typeof s.sessionId === "string" &&
    typeof s.updatedAt === "string" &&
    (s.promptCurrentTime === undefined ||
      typeof s.promptCurrentTime === "string") &&
    Array.isArray(s.assistantRaw) &&
    (s.assistantRaw as unknown[]).every(isAssistantRawEntry) &&
    Array.isArray(s.remoteToolCalls) &&
    (s.remoteToolCalls as unknown[]).every(isRemoteToolCallMeta)
  );
};

export function buildBranchReferenceFilter(
  ctx: ExtensionContext,
): ClineStateImportOptions {
  const assistantTimestamps = new Set<number>();
  const toolCallIds = new Set<string>();

  for (const raw of ctx.sessionManager.getBranch()) {
    const entry = raw as unknown as Record<string, unknown>;

    if (entry.type === "message") {
      const msg = entry.message as Record<string, unknown> | null;
      if (!msg) continue;

      if (msg.role === "assistant") {
        if (typeof msg.timestamp === "number")
          assistantTimestamps.add(msg.timestamp);
        if (Array.isArray(msg.content)) {
          for (const b of msg.content as Record<string, unknown>[]) {
            if (b?.type === "toolCall" && typeof b.id === "string")
              toolCallIds.add(b.id);
          }
        }
      } else if (
        msg.role === "toolResult" &&
        typeof msg.toolCallId === "string"
      ) {
        toolCallIds.add(msg.toolCallId);
      }
      continue;
    }

    if (entry.type === "custom") {
      if (
        entry.customType === ASSISTANT_RAW_ENTRY_TYPE &&
        isAssistantRawEntry(entry.data)
      ) {
        assistantTimestamps.add(
          (entry.data as { timestamp: number }).timestamp,
        );
      } else if (
        entry.customType === REMOTE_TOOL_CALL_ENTRY_TYPE &&
        isRemoteToolCallMeta(entry.data)
      ) {
        toolCallIds.add((entry.data as { toolCallId: string }).toolCallId);
      }
    }
  }

  return { assistantTimestamps, toolCallIds, preferExisting: true };
}

export async function loadSessionState(
  sessionId: string,
): Promise<ClineStateSnapshot | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(statePath(sessionId), "utf-8"));
    if (!isPersistedState(parsed)) return null;
    const { promptCurrentTime, assistantRaw, remoteToolCalls } = parsed;
    return {
      ...(promptCurrentTime ? { promptCurrentTime } : {}),
      assistantRaw,
      remoteToolCalls,
    };
  } catch {
    return null;
  }
}

export async function saveSessionState(
  sessionId: string,
  snapshot: ClineStateSnapshot,
): Promise<void> {
  const file = statePath(sessionId);
  await fs.mkdir(path.dirname(file), { recursive: true });

  const payload: PersistedState = {
    version: 1,
    sessionId,
    updatedAt: new Date().toISOString(),
    ...(snapshot.promptCurrentTime
      ? { promptCurrentTime: snapshot.promptCurrentTime }
      : {}),
    assistantRaw: snapshot.assistantRaw,
    remoteToolCalls: snapshot.remoteToolCalls,
  };

  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(payload), "utf-8");
  await fs.rename(tmp, file);
}
