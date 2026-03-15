import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { mapRemoteToolCall } from "../../../src/bridge/cline-to-pi/map-tool-call";
import { withWorkspace } from "../../helpers/workspace";

test("single-block replace_in_file maps to edit when edit is available", () => {
  const mapping = mapRemoteToolCall(
    1,
    "call-1",
    "replace_in_file",
    {
      path: "README.md",
      diff: [
        "------- SEARCH",
        "before",
        "=======",
        "after",
        "+++++++ REPLACE",
      ].join("\n"),
    },
    { activeTools: new Set(["edit"]) },
  );

  assert.ok(mapping);
  assert.equal(mapping.kind, "tool_call");
  assert.equal(mapping.runtimeToolName, "edit");
  assert.deepEqual(mapping.runtimeArguments, {
    path: "README.md",
    oldText: "before",
    newText: "after",
  });
});

test("single-block replace_in_file prefers edit over write", () => {
  const mapping = mapRemoteToolCall(
    1,
    "call-1b",
    "replace_in_file",
    {
      path: "README.md",
      diff: [
        "------- SEARCH",
        "before",
        "=======",
        "after",
        "+++++++ REPLACE",
      ].join("\n"),
    },
    { activeTools: new Set(["edit", "write"]) },
  );

  assert.ok(mapping);
  assert.equal(mapping.kind, "tool_call");
  assert.equal(mapping.runtimeToolName, "edit");
});

test("multi-block replace_in_file maps to write with final content", () =>
  withWorkspace(
    "pi-cline-map-replace-write-",
    async (workspaceDir) => {
      const filePath = path.join(workspaceDir, "README.md");
      writeFileSync(filePath, "alpha\nbeta\ngamma\n", "utf8");

      const diff = [
        "------- SEARCH",
        "alpha",
        "=======",
        "ALPHA",
        "+++++++ REPLACE",
        "",
        "------- SEARCH",
        "gamma",
        "=======",
        "GAMMA",
        "+++++++ REPLACE",
      ].join("\n");

      const mapping = mapRemoteToolCall(
        1,
        "call-2",
        "replace_in_file",
        {
          path: "README.md",
          diff,
        },
        { activeTools: new Set(["write"]) },
        workspaceDir,
      );

      assert.ok(mapping);
      assert.equal(mapping.kind, "tool_call");
      assert.equal(mapping.runtimeToolName, "write");
      assert.deepEqual(mapping.runtimeArguments, {
        path: "README.md",
        content: "ALPHA\nbeta\nGAMMA\n",
      });
    },
    { readme: false },
  ));

test("list_code_definition_names maps to bash for runtime emulation", () => {
  const mapping = mapRemoteToolCall(
    1,
    "call-3",
    "list_code_definition_names",
    {
      path: "src",
    },
    { activeTools: new Set(["bash"]) },
  );

  assert.ok(mapping);
  assert.equal(mapping.kind, "tool_call");
  assert.equal(mapping.runtimeToolName, "bash");
  assert.match(String(mapping.runtimeArguments.command), /rg/);
  assert.match(String(mapping.runtimeArguments.command), /src/);
});

test("prompt-alignment tools pass through to matching runtime tools when available", () => {
  const mapping = mapRemoteToolCall(
    1,
    "call-3b",
    "use_mcp_tool",
    {
      server_name: "github",
      tool_name: "list_prs",
      arguments: "{}",
    },
    { activeTools: new Set(["use_mcp_tool"]) },
  );

  assert.ok(mapping);
  assert.equal(mapping.kind, "tool_call");
  assert.equal(mapping.runtimeToolName, "use_mcp_tool");
  assert.deepEqual(mapping.runtimeArguments, {
    server_name: "github",
    tool_name: "list_prs",
    arguments: "{}",
    task_progress: undefined,
  });
});

test("standalone prompt-alignment tools synthesize internal results when no runtime tool exists", () => {
  const mapping = mapRemoteToolCall(
    1,
    "call-3c",
    "use_mcp_tool",
    {
      server_name: "github",
      tool_name: "list_prs",
      arguments: "{}",
    },
    { activeTools: new Set(["bash"]) },
  );

  assert.ok(mapping);
  assert.equal(mapping.kind, "synthetic_tool_result");
  assert.equal(mapping.runtimeToolName, "use_mcp_tool");
});

test("unsupported cline tools are ignored instead of being converted to bash", () => {
  const mapping = mapRemoteToolCall(
    1,
    "call-4",
    "plan_mode_respond",
    {
      response: "Here is the plan.",
    },
    { activeTools: new Set(["bash"]) },
  );

  assert.equal(mapping, null);
});
