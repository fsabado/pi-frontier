import { semanticToolRegistry } from "../remote-tools";
import type {
  RemoteToolCallPayload,
  RuntimeToolCall,
} from "../remote-tools/types";
import type { RemoteToolCallMeta } from "../shared/remote-tool";

export type { RemoteToolCallPayload } from "../remote-tools/types";

export function buildRemoteToolCallFromRuntimeToolCall(
  toolCall: RuntimeToolCall,
  meta: RemoteToolCallMeta | undefined,
): RemoteToolCallPayload {
  return semanticToolRegistry.buildRemoteToolCallFromRuntimeToolCall(
    toolCall,
    meta,
  );
}

export function serializeRemoteToolCallToXml(
  remoteName: string,
  remoteArgs: Record<string, unknown>,
) {
  return semanticToolRegistry.serializeRemoteToolCallToXml(
    remoteName,
    remoteArgs,
  );
}
