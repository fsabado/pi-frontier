import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { clineDisplayPath } from "../../../lib/path";
import type { RemoteToolCallMeta } from "../../shared/remote-tool";
import { readFinalFileContent } from "./shared";

const readLikeRemoteToolNames = new Set([
  "read_file",
  "list_files",
  "search_files",
  "list_code_definition_names",
]);

function formatFileEditResult(
  remoteName: "replace_in_file" | "write_to_file",
  filePath: string,
  finalContent: string | undefined,
  resultText: string,
) {
  if (!finalContent) {
    return `[${remoteName} for '${filePath}'] Result:\n${resultText || "The file was updated successfully."}`;
  }

  return (
    `[${remoteName} for '${filePath}'] Result:\n` +
    `The content was successfully saved to ${filePath}.\n\n` +
    `Here is the full, updated content of the file that was saved:\n\n` +
    `<final_file_content path="${filePath}">\n${finalContent}\n\n</final_file_content>\n\n` +
    `IMPORTANT: For any future changes to this file, use the final_file_content shown above as your reference. This content reflects the current state of the file, including any auto-formatting (e.g., if you used single quotes but the formatter converted them to double quotes). Always base your SEARCH/REPLACE operations on this final version to ensure accuracy.`
  );
}

export function isReadLikeRemoteToolName(remoteName: string) {
  return readLikeRemoteToolNames.has(remoteName);
}

export function formatReadLikeToolResult(
  meta: RemoteToolCallMeta,
  resultText: string,
) {
  const filePath = clineDisplayPath(meta.remoteArgs.path);
  return `[${meta.remoteName} for '${filePath}'] Result:\n${resultText}`;
}

export function formatWriteToFileResult(
  meta: RemoteToolCallMeta,
  resultText: string,
  cwd: string,
) {
  const filePath = clineDisplayPath(meta.remoteArgs.path);
  return formatFileEditResult(
    "write_to_file",
    filePath,
    readFinalFileContent(filePath, cwd) ??
      (typeof meta.remoteArgs.content === "string"
        ? meta.remoteArgs.content
        : undefined),
    resultText,
  );
}

export function formatReplaceInFileResult(
  meta: RemoteToolCallMeta,
  result: ToolResultMessage,
  resultText: string,
  cwd: string,
) {
  const filePath = clineDisplayPath(meta.remoteArgs.path);
  return formatFileEditResult(
    "replace_in_file",
    filePath,
    result.isError ? undefined : readFinalFileContent(filePath, cwd),
    resultText,
  );
}
