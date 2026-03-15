import assert from "node:assert/strict";
import test from "node:test";
import {
  createProviderHarness,
  rewriteFixtureWorkspacePath,
} from "../helpers/harness";
import {
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

test("stream requires an OAuth-provided Cline access token", async () => {
  const harness = createProviderHarness();
  const model = requireValue(
    harness.provider.models.find(
      (entry) => entry.id === "kwaipilot/kat-coder-pro",
    ),
    "Missing test model",
  );

  const events = harness.provider.streamSimple(
    model,
    {
      messages: harness.context.messages,
      tools: harness.context.tools,
    },
    {
      sessionId: "test-session",
    },
  );

  let errorMessage: string | undefined;
  for await (const event of events) {
    if (event.type === "error") {
      const error = event.error as { errorMessage?: string };
      errorMessage = error.errorMessage;
      break;
    }
  }

  assert.equal(
    errorMessage,
    "No Cline access token found. Log in to Cline in pi.",
  );
});

const streamCases = [
  {
    label: "kat",
    modelId: "kwaipilot/kat-coder-pro",
    scenarioDir: "test/scenarios/test-stream--kwaipilot__kat-coder-pro",
  },
  {
    label: "trinity",
    modelId: "arcee-ai/trinity-large-preview:free",
    scenarioDir:
      "test/scenarios/test-stream--arcee-ai__trinity-large-preview__free",
  },
] as const;

for (const { label, modelId, scenarioDir } of streamCases) {
  test(`simple stream turn matches recorded ${label} fixture shape`, () =>
    withWorkspace(`pi-cline-stream-${label}-`, async (workspaceDir) => {
      const harness = createProviderHarness();
      const fixture = loadJson<RecordedFixture>(
        `${scenarioDir}/fixtures/turn-01.json`,
      );
      const prompts = loadJson<Array<{ prompt: string }>>(
        `${scenarioDir}/logs/prompts.json`,
      );
      const firstPrompt = requireValue(prompts[0], `Missing ${label} prompt`);
      const firstRecordedMessage = requireValue(
        fixture.request.body.messages[1],
        `Missing ${label} recorded message`,
      );

      const requestCapture: RequestCapture[] = [];
      const assistant = await runTurn({
        provider: harness.provider,
        workspaceDir,
        modelId,
        prompt: firstPrompt.prompt,
        responses: [recordedFixtureResponse(fixture.response.body)],
        requestCapture,
        context: harness.context,
        toolDefinitions: harness.pi.getToolDefinitions(),
      });

      const lastRequest = requestCapture.at(-1)?.body;
      assert.ok(lastRequest);
      assert.equal(lastRequest.model, String(fixture.request.body.model));

      assert.deepEqual(
        extractPrimaryText(
          requireValue(lastRequest.messages[1], "Missing first user message"),
        ),
        {
          ...extractPrimaryText(firstRecordedMessage),
          text: rewriteFixtureWorkspacePath(
            extractPrimaryText(firstRecordedMessage).text,
            workspaceDir,
          ),
        },
      );
      assert.equal(findTextBlock(assistant), "STREAM-ACK-1");
    }));
}
