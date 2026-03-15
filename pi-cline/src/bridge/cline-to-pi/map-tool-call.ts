import type { RemoteToolExecutionPlan } from "../remote-tools";
import { semanticToolRegistry } from "../remote-tools";
import type { RemoteToolCallMeta } from "../shared/remote-tool";
import type { PiToolCapabilities } from "../shared/tool-names";

export function mapRemoteToolCall(
  assistantTimestamp: number,
  toolCallId: string,
  remoteName: string,
  remoteArgs: Record<string, unknown>,
  capabilities: PiToolCapabilities,
  cwd = process.cwd(),
): RemoteToolExecutionPlan | null {
  const remoteMeta: RemoteToolCallMeta = {
    toolCallId,
    remoteName,
    remoteArgs,
    assistantTimestamp,
  };

  return semanticToolRegistry.mapRemoteToolCall(remoteMeta, capabilities, cwd);
}
