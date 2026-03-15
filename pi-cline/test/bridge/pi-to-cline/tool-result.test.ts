import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { formatToolResultForCline } from "../../../src/bridge/pi-to-cline/tool-result";
import type { RemoteToolCallMeta } from "../../../src/bridge/shared/remote-tool";
import { withWorkspace } from "../../helpers/workspace";

function createToolResultMessage(text: string, isError = false) {
  return {
    role: "toolResult" as const,
    toolCallId: "call-1",
    toolName: "write",
    content: [{ type: "text" as const, text }],
    isError,
    timestamp: Date.now(),
  };
}

test("write_to_file results include final_file_content from disk", () =>
  withWorkspace(
    "pi-cline-tool-result-write-",
    async (workspaceDir) => {
      const filePath = path.join(workspaceDir, "README.md");
      writeFileSync(filePath, "hello\nworld\n", "utf8");

      const meta: RemoteToolCallMeta = {
        assistantTimestamp: 1,
        toolCallId: "call-1",
        remoteName: "write_to_file",
        remoteArgs: {
          path: "README.md",
          content: "stale content",
        },
      };

      const text = formatToolResultForCline(
        meta,
        createToolResultMessage("Successfully wrote 12 bytes to README.md"),
        workspaceDir,
      );

      assert.match(text, /\[write_to_file for '.\/README.md'\] Result:/);
      assert.match(text, /<final_file_content path=".\/README.md">/);
      assert.match(text, /hello\nworld/);
    },
    { readme: false },
  ));

test("replace_in_file results include final_file_content from disk", () =>
  withWorkspace(
    "pi-cline-tool-result-edit-",
    async (workspaceDir) => {
      const filePath = path.join(workspaceDir, "README.md");
      writeFileSync(filePath, "after\n", "utf8");

      const meta: RemoteToolCallMeta = {
        assistantTimestamp: 1,
        toolCallId: "call-2",
        remoteName: "replace_in_file",
        remoteArgs: {
          path: "README.md",
          diff: [
            "------- SEARCH",
            "before",
            "=======",
            "after",
            "+++++++ REPLACE",
          ].join("\n"),
        },
      };

      const text = formatToolResultForCline(
        meta,
        createToolResultMessage("Successfully replaced text in README.md."),
        workspaceDir,
      );

      assert.match(text, /\[replace_in_file for '.\/README.md'\] Result:/);
      assert.match(text, /<final_file_content path=".\/README.md">/);
      assert.match(text, /after/);
      assert.equal(readFileSync(filePath, "utf8"), "after\n");
    },
    { readme: false },
  ));
