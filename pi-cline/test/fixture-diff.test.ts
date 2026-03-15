import test from "node:test";
import {
  assertTextEqualWithDiff,
  normalizeFixtureComparisonText,
} from "./helpers/fixture-diff";
import { createProviderHarness } from "./helpers/harness";
import {
  createMockResponseFromAssistantText,
  extractAssistantContents,
  extractPrimaryText,
  loadJson,
  type RecordedFixture,
  type RequestCapture,
  recordedFixtureResponse,
  requireValue,
  runTurn,
} from "./helpers/provider-harness";
import { withWorkspace } from "./helpers/workspace";

function captureSystemPrompt(requestCapture: RequestCapture[]): string {
  return String(
    requireValue(
      requireValue(requestCapture[0], "Missing request").body.messages[0],
      "Missing system prompt message",
    ).content,
  );
}

function expectedSystemPrompt(fixture: RecordedFixture): string {
  return String(
    requireValue(
      fixture.request.body.messages[0],
      "Missing expected system prompt message",
    ).content,
  );
}

test("normalized trinity system prompt stays fully aligned with recorded cline fixture", () =>
  withWorkspace("pi-cline-fixture-diff-", async (workspaceDir) => {
    const harness = createProviderHarness();
    const fixture = loadJson<RecordedFixture>(
      "test/scenarios/test-stream--arcee-ai__trinity-large-preview__free/fixtures/turn-01.json",
    );

    const requestCapture: RequestCapture[] = [];
    await runTurn({
      provider: harness.provider,
      workspaceDir,
      modelId: "arcee-ai/trinity-large-preview:free",
      prompt:
        "[stream/1] Use attempt_completion tool. Set result to exactly this text and nothing else: STREAM-ACK-1",
      responses: [recordedFixtureResponse(fixture.response.body)],
      requestCapture,
      context: harness.context,
      toolDefinitions: harness.pi.getToolDefinitions(),
    });

    assertTextEqualWithDiff(
      normalizeFixtureComparisonText(
        captureSystemPrompt(requestCapture),
        workspaceDir,
      ),
      expectedSystemPrompt(fixture),
      "trinity system prompt",
    );
  }));

test("normalized kat system prompt stays fully aligned with recorded cline fixture", () =>
  withWorkspace("pi-cline-fixture-kat-", async (workspaceDir) => {
    const harness = createProviderHarness();
    const fixture = loadJson<RecordedFixture>(
      "test/scenarios/test-stream--kwaipilot__kat-coder-pro/fixtures/turn-01.json",
    );

    const requestCapture: RequestCapture[] = [];
    await runTurn({
      provider: harness.provider,
      workspaceDir,
      modelId: "kwaipilot/kat-coder-pro",
      prompt:
        "[stream/1] Use attempt_completion tool. Set result to exactly this text and nothing else: STREAM-ACK-1",
      responses: [recordedFixtureResponse(fixture.response.body)],
      requestCapture,
      context: harness.context,
      toolDefinitions: harness.pi.getToolDefinitions(),
    });

    assertTextEqualWithDiff(
      normalizeFixtureComparisonText(
        captureSystemPrompt(requestCapture),
        workspaceDir,
      ),
      expectedSystemPrompt(fixture),
      "kat system prompt",
    );
  }));

test("normalized final request conversation stays aligned with recorded cline fixture", () =>
  withWorkspace("pi-cline-fixture-body-", async (workspaceDir) => {
    const harness = createProviderHarness();
    const fixture = loadJson<RecordedFixture>(
      "test/scenarios/test-stream-with-tool-call-simple--kwaipilot__kat-coder-pro/fixtures/turn-01.json",
    );
    const assistantMessages = extractAssistantContents(fixture);

    const requestCapture: RequestCapture[] = [];
    await runTurn({
      provider: harness.provider,
      workspaceDir,
      modelId: "kwaipilot/kat-coder-pro",
      prompt:
        "[tool-simple/1]\nUse tools:\n1) Create ./tmp/note.txt: line1=hello, line2=world\n2) Read the file back\n3) Run: shasum -a 256 ./tmp/note.txt\nEnd with token SIMPLE-TOOL-OK.",
      responses: [
        ...assistantMessages.map(createMockResponseFromAssistantText),
        recordedFixtureResponse(fixture.response.body),
      ],
      requestCapture,
      context: harness.context,
      toolDefinitions: harness.pi.getToolDefinitions(),
    });

    const actualConversation = requireValue(
      requestCapture.at(-1),
      "Missing final request",
    )
      .body.messages.slice(1)
      .map(extractPrimaryText)
      .map((message) => ({
        ...message,
        text: normalizeFixtureComparisonText(message.text, workspaceDir),
      }));
    const expectedConversation = fixture.request.body.messages
      .slice(1)
      .map(extractPrimaryText);

    assertTextEqualWithDiff(
      JSON.stringify(actualConversation, null, 2),
      JSON.stringify(expectedConversation, null, 2),
      "normalized recorded conversation",
    );
  }));
