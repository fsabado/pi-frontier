import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { createProviderHarness } from "./helpers/harness";
import {
  createMockResponseFromAssistantText,
  findTextBlock,
  type RequestCapture,
  runTurn,
} from "./helpers/provider-harness";
import { withWorkspace } from "./helpers/workspace";

test("provider registers the sudosubin-style cline oauth flow", () => {
  const harness = createProviderHarness();

  assert.equal(harness.provider.authHeader, false);
  assert.ok(harness.provider.oauth);
  assert.equal(harness.provider.oauth?.name, "Cline");
  assert.equal(typeof harness.provider.oauth?.login, "function");
  assert.equal(typeof harness.provider.oauth?.refreshToken, "function");
  assert.equal(typeof harness.provider.oauth?.getApiKey, "function");
  assert.ok(
    harness.provider.models.every((model) => !model.id.startsWith("cline/")),
  );
  assert.equal(harness.pi.getToolDefinitions().size, 0);
});

test("multi-block replace_in_file uses built-in write while preserving remote semantics", () =>
  withWorkspace("pi-cline-diff-", async (workspaceDir) => {
    const harness = createProviderHarness();
    const filePath = path.join(workspaceDir, "README.md");
    writeFileSync(filePath, "alpha\nbeta\ngamma\n", "utf8");

    const requestCapture: RequestCapture[] = [];
    await runTurn({
      provider: harness.provider,
      workspaceDir,
      modelId: "kwaipilot/kat-coder-pro",
      prompt: "update README.md",
      responses: [
        createMockResponseFromAssistantText(
          [
            "<replace_in_file>",
            "<path>README.md</path>",
            "<diff>------- SEARCH",
            "alpha",
            "=======",
            "ALPHA",
            "+++++++ REPLACE",
            "",
            "------- SEARCH",
            "gamma",
            "=======",
            "GAMMA",
            "+++++++ REPLACE</diff>",
            "</replace_in_file>",
          ].join("\n"),
        ),
        createMockResponseFromAssistantText(
          "<attempt_completion><result>Updated the file.</result></attempt_completion>",
        ),
      ],
      requestCapture,
      context: harness.context,
      toolDefinitions: harness.pi.getToolDefinitions(),
    });

    const assistantWithToolCall = harness.context.messages.find(
      (message) =>
        message["role"] === "assistant" &&
        Array.isArray(message["content"]) &&
        message["content"].some(
          (block) =>
            typeof block === "object" &&
            block !== null &&
            block["type"] === "toolCall",
        ),
    );
    const toolCall = (
      assistantWithToolCall?.["content"] as Array<Record<string, unknown>>
    )?.find((block) => block["type"] === "toolCall");

    assert.equal(toolCall?.["name"], "write");
    assert.equal(readFileSync(filePath, "utf8"), "ALPHA\nbeta\nGAMMA\n");
    assert.match(
      JSON.stringify(requestCapture[1]?.body.messages),
      /<replace_in_file>/,
    );
  }));

test("top-level task_progress does not surface as an unsupported tool", () =>
  withWorkspace("pi-cline-task-progress-", async (workspaceDir) => {
    const harness = createProviderHarness();
    const filePath = path.join(workspaceDir, "README.md");
    writeFileSync(filePath, "before\n", "utf8");

    const requestCapture: RequestCapture[] = [];
    const assistant = await runTurn({
      provider: harness.provider,
      workspaceDir,
      modelId: "kwaipilot/kat-coder-pro",
      prompt: "update README.md",
      responses: [
        createMockResponseFromAssistantText(
          [
            "<task_progress>",
            "- [x] Inspect file",
            "- [ ] Update README.md",
            "</task_progress>",
            "<replace_in_file>",
            "<path>README.md</path>",
            "<diff>------- SEARCH",
            "before",
            "=======",
            "after",
            "+++++++ REPLACE</diff>",
            "</replace_in_file>",
          ].join("\n"),
        ),
        createMockResponseFromAssistantText(
          "<attempt_completion><result>Updated after ignoring task progress.</result></attempt_completion>",
        ),
      ],
      requestCapture,
      context: harness.context,
      toolDefinitions: harness.pi.getToolDefinitions(),
    });

    assert.equal(readFileSync(filePath, "utf8"), "after\n");
    assert.equal(
      findTextBlock(assistant),
      "Updated after ignoring task progress.",
    );
    assert.ok(
      !requestCapture.some((capture) =>
        JSON.stringify(capture.body).includes(
          "Unsupported Cline tool: task_progress",
        ),
      ),
    );
  }));

test("prompt-alignment-only tools do not block a later actionable tool", () =>
  withWorkspace("pi-cline-ignored-tool-", async (workspaceDir) => {
    const harness = createProviderHarness();
    const filePath = path.join(workspaceDir, "README.md");
    writeFileSync(filePath, "before\n", "utf8");

    const assistant = await runTurn({
      provider: harness.provider,
      workspaceDir,
      modelId: "kwaipilot/kat-coder-pro",
      prompt: "update README.md",
      responses: [
        createMockResponseFromAssistantText(
          [
            "<use_mcp_tool>",
            "<server_name>github</server_name>",
            "<tool_name>list_prs</tool_name>",
            "<arguments>{}</arguments>",
            "</use_mcp_tool>",
            "<replace_in_file>",
            "<path>README.md</path>",
            "<diff>------- SEARCH",
            "before",
            "=======",
            "after",
            "+++++++ REPLACE</diff>",
            "</replace_in_file>",
          ].join("\n"),
        ),
        createMockResponseFromAssistantText(
          "<attempt_completion><result>Updated after skipping ahead to the actionable tool.</result></attempt_completion>",
        ),
      ],
      requestCapture: [],
      context: harness.context,
      toolDefinitions: harness.pi.getToolDefinitions(),
    });

    assert.equal(readFileSync(filePath, "utf8"), "after\n");
    assert.equal(
      findTextBlock(assistant),
      "Updated after skipping ahead to the actionable tool.",
    );
  }));

test("standalone prompt-alignment tool is handled internally without registering a noop tool", () =>
  withWorkspace("pi-cline-noop-tool-", async (workspaceDir) => {
    const harness = createProviderHarness();
    const requestCapture: RequestCapture[] = [];

    const assistant = await runTurn({
      provider: harness.provider,
      workspaceDir,
      modelId: "kwaipilot/kat-coder-pro",
      prompt: "use an MCP tool",
      responses: [
        createMockResponseFromAssistantText(
          [
            "<use_mcp_tool>",
            "<server_name>github</server_name>",
            "<tool_name>list_prs</tool_name>",
            "<arguments>{}</arguments>",
            "</use_mcp_tool>",
          ].join("\n"),
        ),
        createMockResponseFromAssistantText(
          "<attempt_completion><result>No-op tool path completed.</result></attempt_completion>",
        ),
      ],
      requestCapture,
      context: harness.context,
      toolDefinitions: harness.pi.getToolDefinitions(),
    });

    assert.equal(findTextBlock(assistant), "No-op tool path completed.");
    assert.equal(requestCapture.length, 2);
    assert.equal(
      harness.context.messages.filter(
        (message) => message["role"] === "assistant",
      ).length,
      1,
    );
  }));

test("prompt-alignment tools use matching runtime tools when available", () =>
  withWorkspace("pi-cline-runtime-tool-", async (workspaceDir) => {
    const harness = createProviderHarness();
    const requestCapture: RequestCapture[] = [];

    harness.context.tools.push({
      name: "use_mcp_tool",
      description: "Execute a real MCP tool",
      parameters: { type: "object", properties: {}, required: [] },
    });

    const toolDefinitions = harness.pi.getToolDefinitions();
    toolDefinitions.set("use_mcp_tool", {
      name: "use_mcp_tool",
      label: "Use MCP Tool",
      description: "Execute a real MCP tool",
      parameters: {} as never,
      async execute() {
        return {
          content: [{ type: "text", text: "Listed PRs." }],
          details: undefined,
        };
      },
    } as ToolDefinition);

    await runTurn({
      provider: harness.provider,
      workspaceDir,
      modelId: "kwaipilot/kat-coder-pro",
      prompt: "use an MCP tool",
      responses: [
        createMockResponseFromAssistantText(
          [
            "<use_mcp_tool>",
            "<server_name>github</server_name>",
            "<tool_name>list_prs</tool_name>",
            "<arguments>{}</arguments>",
            "</use_mcp_tool>",
          ].join("\n"),
        ),
        createMockResponseFromAssistantText(
          "<attempt_completion><result>Real runtime tool path completed.</result></attempt_completion>",
        ),
      ],
      requestCapture,
      context: harness.context,
      toolDefinitions,
    });

    const assistantWithToolCall = harness.context.messages.find(
      (message) =>
        message["role"] === "assistant" &&
        Array.isArray(message["content"]) &&
        message["content"].some(
          (block) =>
            typeof block === "object" &&
            block !== null &&
            block["type"] === "toolCall",
        ),
    );
    const toolCall = (
      assistantWithToolCall?.["content"] as Array<Record<string, unknown>>
    )?.find((block) => block["type"] === "toolCall");

    assert.equal(toolCall?.["name"], "use_mcp_tool");
    assert.match(
      JSON.stringify(requestCapture[1]?.body.messages),
      /<use_mcp_tool>/,
    );
  }));
