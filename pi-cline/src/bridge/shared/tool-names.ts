import { semanticToolRegistry } from "../remote-tools";

export type PiToolName = "bash" | "edit" | "read" | "write";

export type RuntimeToolName = string;

export type ClineToolName =
  | "attempt_completion"
  | "execute_command"
  | "list_code_definition_names"
  | "list_files"
  | "read_file"
  | "replace_in_file"
  | "search_files"
  | "write_to_file";

export interface PiToolCapabilities {
  activeTools: Set<string>;
}

export function getSupportedClineToolNames(
  capabilities: PiToolCapabilities,
): ClineToolName[] {
  return semanticToolRegistry.getAdvertisedToolIds(
    capabilities,
  ) as ClineToolName[];
}

export function inferDefaultRemoteToolName(runtimeToolName: string) {
  return semanticToolRegistry.inferDefaultRemoteToolName(runtimeToolName);
}
