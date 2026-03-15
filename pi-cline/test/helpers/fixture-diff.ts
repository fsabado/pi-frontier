import assert from "node:assert/strict";
import { realpathSync } from "node:fs";

export function normalizeFixtureComparisonText(
  text: string,
  workspaceDir: string,
) {
  const realWorkspaceDir = realpathSync(workspaceDir);

  return text
    .replaceAll(realWorkspaceDir, "/workspace")
    .replace(
      /# Current Time\n.*\n/g,
      "# Current Time\n1/1/1970, 12:00:00 AM (UTC, UTC+0:00)\n",
    )
    .replace(/Home Directory: .*$/gm, "Home Directory: /home/user")
    .replace(/Operating System: .*$/gm, "Operating System: macOS Tahoe")
    .replace(
      /Default Shell: .*$/gm,
      "Default Shell: /run/current-system/sw/bin/bash",
    )
    .replace(
      /origin:\s*https:\/\/github\.com\/[^\s"\\]+\.git/g,
      "origin: https://github.com/test/test.git",
    )
    .replace(/\b[a-f0-9]{40}\b/g, "0000000000000000000000000000000000000000")
    .replace(/"hint":\s*"[^"]+"/g, '"hint": "workspace"');
}

export function assertTextEqualWithDiff(
  actual: string,
  expected: string,
  label: string,
) {
  if (actual === expected) {
    return;
  }

  const actualLines = actual.split(/\n/);
  const expectedLines = expected.split(/\n/);
  const lineCount = Math.max(actualLines.length, expectedLines.length);
  const diffLines: string[] = [];

  for (let index = 0; index < lineCount; index += 1) {
    const actualLine = actualLines[index] ?? "";
    const expectedLine = expectedLines[index] ?? "";
    if (actualLine === expectedLine) {
      continue;
    }

    diffLines.push(
      `line ${index + 1}\nEXPECTED: ${expectedLine}\nACTUAL  : ${actualLine}`,
    );

    if (diffLines.length >= 20) {
      break;
    }
  }

  assert.fail(`${label} mismatch\n\n${diffLines.join("\n\n")}`);
}
