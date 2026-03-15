export interface RemoteToolCallMeta {
  toolCallId: string;
  remoteName: string;
  remoteArgs: Record<string, unknown>;
  assistantTimestamp: number;
}
