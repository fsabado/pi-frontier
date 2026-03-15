import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  createProviderHarness,
  rewriteFixtureWorkspacePath,
} from "../helpers/harness";
import {
  createMockResponseFromAssistantText,
  extractAssistantContents,
  extractPrimaryText,
  findTextBlock,
  loadJson,
  type RecordedFixture,
  type RequestCapture,
  recordedFixtureResponse,
  requireValue,
  runTurn,
} from "../helpers/provider-harness";
import { withWorkspace } from "../helpers/workspace";

test("tool-call simple turn reproduces recorded final request conversation", () =>
  withWorkspace("pi-cline-tool-", async (workspaceDir) => {
    const harness = createProviderHarness();
    const fixture = loadJson<RecordedFixture>(
      "test/scenarios/test-stream-with-tool-call-simple--kwaipilot__kat-coder-pro/fixtures/turn-01.json",
    );
    const prompts = loadJson<Array<{ prompt: string }>>(
      "test/scenarios/test-stream-with-tool-call-simple--kwaipilot__kat-coder-pro/logs/prompts.json",
    );
    const firstPrompt = requireValue(prompts[0], "Missing tool-call prompt");
    const assistantMessages = extractAssistantContents(fixture);

    const requestCapture: RequestCapture[] = [];
    const assistant = await runTurn({
      provider: harness.provider,
      workspaceDir,
      modelId: "kwaipilot/kat-coder-pro",
      prompt: firstPrompt.prompt,
      responses: [
        ...assistantMessages.map(createMockResponseFromAssistantText),
        recordedFixtureResponse(fixture.response.body),
      ],
      requestCapture,
      context: harness.context,
      toolDefinitions: harness.pi.getToolDefinitions(),
    });

    const lastRequest = requestCapture.at(-1)?.body;
    assert.ok(lastRequest);
    assert.equal(lastRequest.model, String(fixture.request.body.model));
    assert.deepEqual(
      lastRequest.messages.slice(1).map(extractPrimaryText),
      fixture.request.body.messages.slice(1).map((message) => ({
        ...extractPrimaryText(message),
        text: rewriteFixtureWorkspacePath(
          extractPrimaryText(message).text,
          workspaceDir,
        ),
      })),
    );
    assert.match(
      readFileSync(path.join(workspaceDir, "tmp", "note.txt"), "utf8"),
      /^hello\nworld/,
    );
    assert.match(String(findTextBlock(assistant)), /completed|SIMPLE-TOOL-OK/i);
  }));
