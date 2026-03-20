import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { createStateStore } from "../../src/provider/state.js";

test("rememberToolCallMeta stores and persists", () => {
  const appended: Array<{ type: string; data: unknown }> = [];
  const state = createStateStore((type, data) => {
    appended.push({ type, data });
  });

  state.rememberToolCallMeta({
    toolCallId: "call-1",
    piToolName: "read",
    piToolArgs: { path: "README.md" },
    assistantTimestamp: 1000,
  });

  const meta = state.getToolCallMeta("call-1");
  assert.ok(meta);
  assert.equal(meta.piToolName, "read");
  assert.deepEqual(meta.piToolArgs, { path: "README.md" });
  assert.equal(meta.assistantTimestamp, 1000);

  assert.equal(appended.length, 1);
  assert.equal(appended[0]?.type, "pi-cursor-agent:tool-call-meta");
});

test("rememberAssistantContent stores and persists", () => {
  const appended: Array<{ type: string; data: unknown }> = [];
  const state = createStateStore((type, data) => {
    appended.push({ type, data });
  });

  state.rememberAssistantContent({
    timestamp: 1000,
    blocks: [
      { type: "text", text: "Hello" },
      {
        type: "toolCall",
        id: "call-1",
        name: "read",
        arguments: { path: "README.md" },
      },
    ],
  });

  const content = state.getAssistantContent(1000);
  assert.ok(content);
  assert.equal(content.blocks.length, 2);

  assert.equal(appended.length, 1);
  assert.equal(appended[0]?.type, "pi-cursor-agent:assistant-content");
});

test("getToolCallMeta returns undefined for unknown id", () => {
  const state = createStateStore(() => {});
  assert.equal(state.getToolCallMeta("nonexistent"), undefined);
});

test("getAssistantContent returns undefined for unknown timestamp", () => {
  const state = createStateStore(() => {});
  assert.equal(state.getAssistantContent(9999), undefined);
});

test("resetFromContext restores tool call meta and assistant content", () => {
  const state = createStateStore(() => {});

  state.resetFromContext({
    sessionManager: {
      getBranch() {
        return [
          {
            type: "custom",
            customType: "pi-cursor-agent:tool-call-meta",
            data: {
              toolCallId: "call-1",
              piToolName: "bash",
              piToolArgs: { command: "ls" },
              assistantTimestamp: 1000,
            },
          },
          {
            type: "custom",
            customType: "pi-cursor-agent:assistant-content",
            data: {
              timestamp: 1000,
              blocks: [{ type: "text", text: "Running ls..." }],
            },
          },
        ];
      },
    },
  } as ExtensionContext);

  const meta = state.getToolCallMeta("call-1");
  assert.ok(meta);
  assert.equal(meta.piToolName, "bash");
  assert.deepEqual(meta.piToolArgs, { command: "ls" });

  const content = state.getAssistantContent(1000);
  assert.ok(content);
  assert.equal(content.blocks.length, 1);
});

test("resetFromContext ignores malformed entries", () => {
  const state = createStateStore(() => {});

  state.resetFromContext({
    sessionManager: {
      getBranch() {
        return [
          {
            type: "custom",
            customType: "pi-cursor-agent:tool-call-meta",
            data: { toolCallId: "", piToolName: "read" }, // invalid: empty toolCallId
          },
          {
            type: "custom",
            customType: "pi-cursor-agent:assistant-content",
            data: { timestamp: "not-a-number" }, // invalid: wrong type
          },
          {
            type: "custom",
            customType: "pi-cursor-agent:tool-call-meta",
            data: {
              toolCallId: "valid-call",
              piToolName: "read",
              piToolArgs: { path: "test.ts" },
              assistantTimestamp: 2000,
            },
          },
        ];
      },
    },
  } as ExtensionContext);

  assert.equal(state.getToolCallMeta(""), undefined);
  assert.ok(state.getToolCallMeta("valid-call"));
});

test("resetFromContext clears previous state", () => {
  const state = createStateStore(() => {});

  state.rememberToolCallMeta({
    toolCallId: "old-call",
    piToolName: "read",
    piToolArgs: {},
    assistantTimestamp: 500,
  });

  state.rememberAssistantContent({
    timestamp: 500,
    blocks: [{ type: "text", text: "old" }],
  });

  state.resetFromContext({
    sessionManager: {
      getBranch() {
        return [];
      },
    },
  } as unknown as ExtensionContext);

  assert.equal(state.getToolCallMeta("old-call"), undefined);
  assert.equal(state.getAssistantContent(500), undefined);
});

test("resetFromContext ignores non-custom entries", () => {
  const state = createStateStore(() => {});

  state.resetFromContext({
    sessionManager: {
      getBranch() {
        return [
          { type: "user", content: "hello" },
          { type: "assistant", content: [] },
          {
            type: "custom",
            customType: "pi-cursor-agent:tool-call-meta",
            data: {
              toolCallId: "call-x",
              piToolName: "write",
              piToolArgs: { path: "a.txt", content: "hi" },
              assistantTimestamp: 3000,
            },
          },
        ];
      },
    },
  } as ExtensionContext);

  assert.ok(state.getToolCallMeta("call-x"));
});

test("multiple tool calls are tracked independently", () => {
  const appended: Array<{ type: string; data: unknown }> = [];
  const state = createStateStore((type, data) => {
    appended.push({ type, data });
  });

  state.rememberToolCallMeta({
    toolCallId: "call-1",
    piToolName: "read",
    piToolArgs: { path: "a.ts" },
    assistantTimestamp: 1000,
  });

  state.rememberToolCallMeta({
    toolCallId: "call-2",
    piToolName: "bash",
    piToolArgs: { command: "ls" },
    assistantTimestamp: 1000,
  });

  assert.equal(state.getToolCallMeta("call-1")?.piToolName, "read");
  assert.equal(state.getToolCallMeta("call-2")?.piToolName, "bash");
  assert.equal(appended.length, 2);
});
