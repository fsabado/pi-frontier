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
    cursorExecType: "read",
    piToolName: "read",
    piToolArgs: { path: "README.md" },
    assistantTimestamp: 1000,
  });

  const meta = state.getToolCallMeta("call-1");
  assert.ok(meta);
  assert.equal(meta.cursorExecType, "read");
  assert.equal(meta.piToolName, "read");
  assert.deepEqual(meta.piToolArgs, { path: "README.md" });

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

test("returns undefined for unknown ids", () => {
  const state = createStateStore(() => {});
  assert.equal(state.getToolCallMeta("nonexistent"), undefined);
  assert.equal(state.getAssistantContent(9999), undefined);
});

test("resetFromContext restores entries", () => {
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
              cursorExecType: "grep",
              piToolName: "bash",
              piToolArgs: { command: "rg pattern" },
              assistantTimestamp: 1000,
            },
          },
          {
            type: "custom",
            customType: "pi-cursor-agent:assistant-content",
            data: {
              timestamp: 1000,
              blocks: [{ type: "text", text: "Searching..." }],
            },
          },
        ];
      },
    },
  } as ExtensionContext);

  const meta = state.getToolCallMeta("call-1");
  assert.ok(meta);
  assert.equal(meta.cursorExecType, "grep");
  assert.equal(meta.piToolName, "bash");

  const content = state.getAssistantContent(1000);
  assert.ok(content);
  assert.equal(content.blocks.length, 1);
});

test("resetFromContext skips entries missing cursorExecType", () => {
  const state = createStateStore(() => {});

  state.resetFromContext({
    sessionManager: {
      getBranch() {
        return [
          {
            type: "custom",
            customType: "pi-cursor-agent:tool-call-meta",
            data: {
              toolCallId: "no-exec-type",
              piToolName: "read",
              piToolArgs: { path: "a.ts" },
              assistantTimestamp: 1000,
            },
          },
        ];
      },
    },
  } as ExtensionContext);

  assert.equal(state.getToolCallMeta("no-exec-type"), undefined);
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
            data: { toolCallId: "", piToolName: "read" },
          },
          {
            type: "custom",
            customType: "pi-cursor-agent:assistant-content",
            data: { timestamp: "not-a-number" },
          },
          {
            type: "custom",
            customType: "pi-cursor-agent:tool-call-meta",
            data: {
              toolCallId: "valid",
              cursorExecType: "read",
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
  assert.ok(state.getToolCallMeta("valid"));
});

test("resetFromContext clears previous state", () => {
  const state = createStateStore(() => {});

  state.rememberToolCallMeta({
    toolCallId: "old",
    cursorExecType: "read",
    piToolName: "read",
    piToolArgs: {},
    assistantTimestamp: 500,
  });

  state.resetFromContext({
    sessionManager: { getBranch: () => [] },
  } as unknown as ExtensionContext);

  assert.equal(state.getToolCallMeta("old"), undefined);
});

test("multiple tool calls are tracked independently", () => {
  const state = createStateStore(() => {});

  state.rememberToolCallMeta({
    toolCallId: "call-1",
    cursorExecType: "read",
    piToolName: "read",
    piToolArgs: { path: "a.ts" },
    assistantTimestamp: 1000,
  });

  state.rememberToolCallMeta({
    toolCallId: "call-2",
    cursorExecType: "ls",
    piToolName: "bash",
    piToolArgs: { command: "ls" },
    assistantTimestamp: 1000,
  });

  assert.equal(state.getToolCallMeta("call-1")?.cursorExecType, "read");
  assert.equal(state.getToolCallMeta("call-2")?.cursorExecType, "ls");
});
