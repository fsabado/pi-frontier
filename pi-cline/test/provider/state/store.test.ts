import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { buildBranchReferenceFilter } from "../../../src/provider/session-disk-state";
import { createStateStore } from "../../../src/provider/state";

test("state store memoizes the first prompt current time", () => {
  const appended: Array<{ type: string; data: unknown }> = [];
  const state = createStateStore((type, data) => {
    appended.push({ type, data });
  });

  let callCount = 0;
  const first = state.getOrCreatePromptCurrentTime(() => {
    callCount += 1;
    return "3/11/2026, 2:26:47 AM";
  });
  const second = state.getOrCreatePromptCurrentTime(() => {
    callCount += 1;
    return "3/11/2026, 3:00:00 AM";
  });

  assert.equal(first, "3/11/2026, 2:26:47 AM");
  assert.equal(second, "3/11/2026, 2:26:47 AM");
  assert.equal(callCount, 1);
  assert.deepEqual(appended, [
    {
      type: "pi-cline:prompt-current-time",
      data: { value: "3/11/2026, 2:26:47 AM" },
    },
  ]);
});

test("state store restores the memoized prompt current time from session state", () => {
  const state = createStateStore(() => {});

  state.resetFromContext({
    sessionManager: {
      getBranch() {
        return [
          {
            type: "custom",
            customType: "pi-cline:prompt-current-time",
            data: { value: "3/11/2026, 2:26:47 AM" },
          },
        ];
      },
    },
  } as ExtensionContext);

  const value = state.getOrCreatePromptCurrentTime(
    () => "3/11/2026, 3:00:00 AM",
  );

  assert.equal(value, "3/11/2026, 2:26:47 AM");
});

test("state store exports and imports snapshot data", () => {
  const source = createStateStore(() => {});
  source.rememberAssistantRaw({ timestamp: 10, rawText: "<write_to_file />" });
  source.rememberRemoteToolCall({
    toolCallId: "call-1",
    remoteName: "write_to_file",
    remoteArgs: { path: "a.txt", content: "hello" },
    assistantTimestamp: 10,
  });
  source.getOrCreatePromptCurrentTime(() => "3/11/2026, 2:26:47 AM");

  const target = createStateStore(() => {});
  target.importSnapshot(source.exportSnapshot());

  assert.equal(target.getAssistantRaw(10), "<write_to_file />");
  assert.deepEqual(target.getRemoteToolCall("call-1"), {
    toolCallId: "call-1",
    remoteName: "write_to_file",
    remoteArgs: { path: "a.txt", content: "hello" },
    assistantTimestamp: 10,
  });
  assert.equal(
    target.getOrCreatePromptCurrentTime(() => "different"),
    "3/11/2026, 2:26:47 AM",
  );
});

test("branch reference filter only imports entries present in the branch", () => {
  const state = createStateStore(() => {});
  state.importSnapshot(
    {
      promptCurrentTime: "3/11/2026, 2:26:47 AM",
      assistantRaw: [
        { timestamp: 100, rawText: "keep" },
        { timestamp: 200, rawText: "drop" },
      ],
      remoteToolCalls: [
        {
          toolCallId: "call-keep",
          remoteName: "write_to_file",
          remoteArgs: { path: "keep.txt", content: "ok" },
          assistantTimestamp: 100,
        },
        {
          toolCallId: "call-drop",
          remoteName: "write_to_file",
          remoteArgs: { path: "drop.txt", content: "no" },
          assistantTimestamp: 200,
        },
      ],
    },
    buildBranchReferenceFilter({
      sessionManager: {
        getBranch() {
          return [
            {
              type: "message",
              message: {
                role: "assistant",
                timestamp: 100,
                content: [
                  {
                    type: "toolCall",
                    id: "call-keep",
                    name: "write",
                    arguments: {},
                  },
                ],
              },
            },
            {
              type: "message",
              message: {
                role: "toolResult",
                toolCallId: "call-keep",
              },
            },
          ];
        },
      },
    } as ExtensionContext),
  );

  assert.equal(state.getAssistantRaw(100), "keep");
  assert.equal(state.getAssistantRaw(200), undefined);
  assert.equal(
    state.getRemoteToolCall("call-keep")?.remoteName,
    "write_to_file",
  );
  assert.equal(state.getRemoteToolCall("call-drop"), undefined);
});
