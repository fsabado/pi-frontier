import assert from "node:assert/strict";
import test from "node:test";
import {
  createProviderHarness,
  rewriteFixtureWorkspacePath,
  stripClineProviderPrefix,
} from "../helpers/harness";
import {
  extractPrimaryText,
  loadJson,
  type RecordedFixture,
  type RequestCapture,
  recordedFixtureResponse,
  requireValue,
  runTurn,
} from "../helpers/provider-harness";
import { withWorkspace } from "../helpers/workspace";

test("raw assistant history is preserved across model switch turns", () =>
  withWorkspace("pi-cline-switch-", async (workspaceDir) => {
    const harness = createProviderHarness();
    const turn1Fixture = loadJson<RecordedFixture>(
      "test/scenarios/test-stream-with-model-switch--kwaipilot__kat-coder-pro--arcee-ai__trinity-large-preview__free/fixtures/turn-01.json",
    );
    const turn2Fixture = loadJson<RecordedFixture>(
      "test/scenarios/test-stream-with-model-switch--kwaipilot__kat-coder-pro--arcee-ai__trinity-large-preview__free/fixtures/turn-02.json",
    );
    const prompts = loadJson<Array<{ prompt: string; model: string }>>(
      "test/scenarios/test-stream-with-model-switch--kwaipilot__kat-coder-pro--arcee-ai__trinity-large-preview__free/logs/prompts.json",
    );
    const firstPrompt = requireValue(
      prompts[0],
      "Missing first model switch prompt",
    );
    const secondPrompt = requireValue(
      prompts[1],
      "Missing second model switch prompt",
    );

    const requestCapture: RequestCapture[] = [];
    await runTurn({
      provider: harness.provider,
      workspaceDir,
      modelId: stripClineProviderPrefix(firstPrompt.model),
      prompt: firstPrompt.prompt,
      responses: [recordedFixtureResponse(turn1Fixture.response.body)],
      requestCapture,
      context: harness.context,
      toolDefinitions: harness.pi.getToolDefinitions(),
    });

    await runTurn({
      provider: harness.provider,
      workspaceDir,
      modelId: stripClineProviderPrefix(secondPrompt.model),
      prompt: secondPrompt.prompt,
      responses: [recordedFixtureResponse(turn2Fixture.response.body)],
      requestCapture,
      context: harness.context,
      toolDefinitions: harness.pi.getToolDefinitions(),
    });

    const lastRequest = requestCapture.at(-1)?.body;
    assert.ok(lastRequest);
    assert.equal(lastRequest.model, String(turn2Fixture.request.body.model));
    assert.deepEqual(
      lastRequest.messages.slice(1).map(extractPrimaryText),
      turn2Fixture.request.body.messages.slice(1).map((message) => ({
        ...extractPrimaryText(message),
        text: rewriteFixtureWorkspacePath(
          extractPrimaryText(message).text,
          workspaceDir,
        ),
      })),
    );
  }));
