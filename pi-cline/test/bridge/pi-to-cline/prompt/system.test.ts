import assert from "node:assert/strict";
import test from "node:test";
import type { PromptRuntimeInfo } from "../../../../src/bridge/pi-to-cline/prompt/runtime-info";
import { buildClineSystemPrompt } from "../../../../src/bridge/pi-to-cline/prompt/system";

const runtimeInfo: PromptRuntimeInfo = {
  operatingSystem: "macOS 15.0",
  ide: "Cline CLI - Node.js",
  defaultShell: "/bin/zsh",
  homeDirectory: "/Users/tester",
  currentWorkingDirectory: "/tmp/pi-cline-real-cwd",
  detectedCliTools: ["git", "node", "npm"],
  workspaceConfiguration: {
    workspaces: {
      "/tmp/pi-cline-real-cwd": {
        hint: "pi-cline-real-cwd",
      },
    },
  },
};

test("system prompt includes dynamic system information", () => {
  const text = buildClineSystemPrompt(
    "arcee-ai/trinity-large-preview:free",
    { activeTools: new Set(["read", "write", "edit", "bash"]) },
    runtimeInfo,
  );

  assert.ok(text.includes("SYSTEM INFORMATION"));
  assert.ok(text.includes("Operating System: macOS 15.0"));
  assert.ok(text.includes("Default Shell: /bin/zsh"));
  assert.ok(text.includes("Home Directory: /Users/tester"));
  assert.ok(text.includes("Current Working Directory: /tmp/pi-cline-real-cwd"));
  assert.ok(
    text.includes(
      "Commands will be executed in the current working directory: /tmp/pi-cline-real-cwd",
    ),
  );
  assert.ok(
    text.includes(
      "The path of a directory (not a file) relative to the current working directory /tmp/pi-cline-real-cwd. Lists definitions across all source files in that directory. To inspect a single file, use read_file instead.",
    ),
  );
  assert.ok(
    text.includes(
      "When fixing a bug, if existing tests fail after your change, your code is likely wrong.",
    ),
  );
  assert.ok(
    text.includes(
      "After making code changes, consider running any available validation tools for the project (such as type checkers, linters, test suites, or build scripts)",
    ),
  );
});
