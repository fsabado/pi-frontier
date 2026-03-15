import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
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
