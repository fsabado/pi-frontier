import fs from "node:fs";
import path from "node:path";
import { normalizePath } from "../../lib/path";
import {
  applySearchReplaceDiff,
  parseSearchReplaceBlocks,
} from "../../lib/search-replace-diff";
import type { RemoteToolExecutionPlan } from "../remote-tools";
import type { RemoteToolCallMeta } from "../shared/remote-tool";
import type { PiToolCapabilities } from "../shared/tool-names";

function resolveAbsolutePath(filePath: string, cwd: string) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
}

export function mapReplaceInFileCall(
  remoteMeta: RemoteToolCallMeta,
  capabilities: PiToolCapabilities,
  cwd: string,
): RemoteToolExecutionPlan {
  const filePath = normalizePath(remoteMeta.remoteArgs.path);
  const diff =
    typeof remoteMeta.remoteArgs.diff === "string"
      ? remoteMeta.remoteArgs.diff
      : "";
  const blocks = parseSearchReplaceBlocks(diff);
  const firstBlock = blocks?.[0];

  if (
    capabilities.activeTools.has("edit") &&
    firstBlock &&
    blocks.length === 1
  ) {
    return {
      kind: "tool_call",
      runtimeToolName: "edit",
      runtimeArguments: {
        path: filePath,
        oldText: firstBlock.search,
        newText: firstBlock.replace,
      },
      remoteMeta,
    };
  }

  if (capabilities.activeTools.has("write")) {
    const absolutePath = resolveAbsolutePath(filePath, cwd);
    const content = fs.readFileSync(absolutePath, "utf8");

    return {
      kind: "tool_call",
      runtimeToolName: "write",
      runtimeArguments: {
        path: filePath,
        content: applySearchReplaceDiff(content, diff, absolutePath),
      },
      remoteMeta,
    };
  }

  throw new Error(
    "replace_in_file requires edit for single-block diffs or write for multi-block SEARCH/REPLACE application.",
  );
}
