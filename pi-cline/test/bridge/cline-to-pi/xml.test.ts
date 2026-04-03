import assert from "node:assert/strict";
import test from "node:test";
import { parseAssistantXmlResponse } from "../../../src/bridge/cline-to-pi/xml";

test("top-level task_progress is ignored while the following tool call is parsed", () => {
  const parsed = parseAssistantXmlResponse(
    [
      "<task_progress>",
      "- [x] Inspect files",
      "- [ ] Edit README.md",
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
  );

  assert.equal(parsed.preambleText, "");
  assert.deepEqual(parsed.toolCalls, [
    {
      name: "replace_in_file",
      parameters: {
        path: "README.md",
        diff: [
          "------- SEARCH",
          "before",
          "=======",
          "after",
          "+++++++ REPLACE",
        ].join("\n"),
      },
    },
  ]);
});

test("parseAssistantMessageV2-style parsing preserves multiple known tool blocks in order", () => {
  const parsed = parseAssistantXmlResponse(
    [
      "<list_code_definition_names>",
      "<path>src</path>",
      "</list_code_definition_names>",
      "<replace_in_file>",
      "<path>README.md</path>",
      "<diff>------- SEARCH",
      "before",
      "=======",
      "after",
      "+++++++ REPLACE</diff>",
      "</replace_in_file>",
    ].join("\n"),
  );

  assert.deepEqual(
    parsed.toolCalls.map((toolCall) => toolCall.name),
    ["list_code_definition_names", "replace_in_file"],
  );
});

test("text blocks containing cline SYSTEM_CONTENT_MARKERS are dropped from preamble", () => {
  const parsed = parseAssistantXmlResponse(
    [
      "[Response interrupted by a tool use result. Only one tool may be used at a time and should be placed at the end of the message.]",
      "",
      "<list_files>",
      "<path>/tmp</path>",
      "<recursive>false</recursive>",
      "</list_files>",
    ].join("\n"),
  );

  assert.equal(parsed.preambleText, "");
  assert.equal(parsed.toolCalls.length, 1);
  assert.equal(parsed.toolCalls[0].name, "list_files");
});
