import assert from "node:assert/strict";
import test from "node:test";
import { getSupportedClineToolNames } from "../../../src/bridge/shared/tool-names";

test("write capability still exposes replace_in_file support", () => {
  const supported = getSupportedClineToolNames({
    activeTools: new Set(["write"]),
  });

  assert.ok(supported.includes("write_to_file"));
  assert.ok(supported.includes("replace_in_file"));
});
