import assert from "node:assert/strict";
import test from "node:test";
import type { Message } from "@mariozechner/pi-ai";
import {
  buildClineRequestBody,
  buildClineRequestHeaders,
} from "../../../src/bridge/pi-to-cline/request-body";
import { createMockModel, createMockState } from "../../helpers/state";

function assistantWithToolCall(
  timestamp: number,
  toolCall: { id: string; name: string; arguments: Record<string, unknown> },
) {
  return {
    role: "assistant" as const,
    timestamp,
    content: [{ type: "toolCall" as const, ...toolCall }],
    api: "cline-chat-completions",
    provider: "cline",
    model: "kwaipilot/kat-coder-pro",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "toolUse" as const,
  };
}

function buildBody(
  messages: Message[],
  state = createMockState(),
  activeTools = new Set<string>(),
) {
  return buildClineRequestBody(
    createMockModel("kwaipilot/kat-coder-pro"),
    { messages, tools: [] },
    "/tmp/workspace",
    state,
    { activeTools },
  );
}

function findAssistantContent(body: ReturnType<typeof buildBody>) {
  return body.messages.find((m) => m.role === "assistant")?.content;
}

test("request headers mimic the Cline CLI signature", () => {
  const headers = buildClineRequestHeaders("session-123");

  assert.deepEqual(headers, {
    "HTTP-Referer": "https://cline.bot",
    "User-Agent": "Cline/3.72.0",
    "X-CLIENT-TYPE": "CLI",
    "X-CLIENT-VERSION": "2.7.0",
    "X-CORE-VERSION": "3.72.0",
    "X-IS-MULTIROOT": "false",
    "X-PLATFORM": "Cline CLI - Node.js",
    "X-PLATFORM-VERSION": "2.7.0",
    "X-Task-ID": "session-123",
    "X-Title": "Cline",
  });
});

test("request headers can represent multi-root workspaces", () => {
  const headers = buildClineRequestHeaders("session-123", true);

  assert.equal(headers["X-IS-MULTIROOT"], "true");
});

test("request body keeps API model ids in modelType/model format", () => {
  const body = buildBody([]);
  assert.equal(body.model, "kwaipilot/kat-coder-pro");
});

test("request body reuses the first prompt current time across turns", () => {
  const state = createMockState({
    promptCurrentTime: "3/11/2026, 2:26:47 AM",
  });

  const firstBody = buildBody(
    [{ role: "user", content: "first", timestamp: 100 }],
    state,
  );
  const secondBody = buildBody(
    [
      { role: "user", content: "first", timestamp: 100 },
      { role: "user", content: "second", timestamp: 102 },
    ],
    state,
  );

  const firstUserMessage = JSON.stringify(firstBody.messages[1]);
  const resumedUserMessage = JSON.stringify(secondBody.messages.at(-1));

  assert.ok(firstUserMessage.includes("3/11/2026, 2:26:47 AM"));
  assert.ok(resumedUserMessage.includes("3/11/2026, 2:26:47 AM"));
});

test("assistant tool-call fallback serializes stored remote tool metadata", () => {
  const toolCallId = "call-1";
  const state = createMockState({
    remoteToolCallsById: new Map([
      [
        toolCallId,
        {
          toolCallId,
          remoteName: "write_to_file",
          remoteArgs: { path: "tmp/note.txt", content: "hello\nworld\n" },
          assistantTimestamp: 123,
        },
      ],
    ]),
  });

  const body = buildBody(
    [
      { role: "user", content: "write the file", timestamp: 100 },
      assistantWithToolCall(123, {
        id: toolCallId,
        name: "write",
        arguments: { path: "tmp/note.txt", content: "ignored by fallback" },
      }),
    ],
    state,
    new Set(["write"]),
  );

  assert.equal(
    findAssistantContent(body),
    "<write_to_file>\n<path>tmp/note.txt</path>\n<content>hello\nworld\n</content>\n</write_to_file>",
  );
});

test("assistant edit fallback reconstructs replace_in_file xml when remote metadata is missing", () => {
  const body = buildBody(
    [
      { role: "user", content: "edit the file", timestamp: 100 },
      assistantWithToolCall(200, {
        id: "call-2",
        name: "edit",
        arguments: {
          path: "README.md",
          oldText: "old line",
          newText: "new line",
        },
      }),
    ],
    createMockState(),
    new Set(["edit"]),
  );

  assert.equal(
    findAssistantContent(body),
    "<replace_in_file>\n<path>README.md</path>\n<diff>------- SEARCH\nold line\n=======\nnew line\n+++++++ REPLACE</diff>\n</replace_in_file>",
  );
});

test("assistant write tool-call still reconstructs replace_in_file xml when remote metadata exists", () => {
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
  const toolCallId = "call-3";

  const body = buildBody(
    [
      { role: "user", content: "edit the file", timestamp: 100 },
      assistantWithToolCall(200, {
        id: toolCallId,
        name: "write",
        arguments: { path: "README.md", content: "ignored write payload" },
      }),
    ],
    createMockState({
      remoteToolCallsById: new Map([
        [
          toolCallId,
          {
            toolCallId,
            remoteName: "replace_in_file",
            remoteArgs: { path: "README.md", diff },
            assistantTimestamp: 200,
          },
        ],
      ]),
    }),
    new Set(["write"]),
  );

  assert.equal(
    findAssistantContent(body),
    `<replace_in_file>\n<path>README.md</path>\n<diff>${diff}</diff>\n</replace_in_file>`,
  );
});
