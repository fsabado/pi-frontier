import assert from "node:assert/strict";
import test from "node:test";
import { buildEnvironmentDetails } from "../../../../src/bridge/pi-to-cline/prompt/environment";
import type { PromptRuntimeInfo } from "../../../../src/bridge/pi-to-cline/prompt/runtime-info";
import { buildTaskUserMessage } from "../../../../src/bridge/pi-to-cline/prompt/task-message";

const promptRuntimeInfo: PromptRuntimeInfo = {
  operatingSystem: "macOS 15.0",
  ide: "Cline CLI - Node.js",
  defaultShell: "/bin/zsh",
  homeDirectory: "/Users/tester",
  currentWorkingDirectory: "/tmp/pi-cline-real-cwd",
  detectedCliTools: ["git", "node", "npm"],
  workspaceConfiguration: {
    workspaces: {
      "/tmp/pi-cline-real-cwd": {
        hint: "pi-cline-real-cwd",
        associatedRemoteUrls: ["origin: https://github.com/example/repo.git"],
        latestGitCommitHash: "1234567890abcdef1234567890abcdef12345678",
      },
    },
  },
};

test("environment details display the real cwd instead of /workspace", () => {
  const cwd = "/tmp/pi-cline-real-cwd";
  const text = buildEnvironmentDetails({
    cwd,
    mode: "ACT MODE",
    includeWorkspaceSnapshot: true,
    currentTime: "3/11/2026, 2:26:47 AM",
    promptRuntimeInfo,
    contextMessages: [],
  });

  assert.ok(text.includes(`# Current Working Directory (${cwd}) Files`));
  assert.ok(!text.includes("# Current Working Directory (/workspace) Files"));
});

test("environment details use the provided memoized current time", () => {
  const text = buildEnvironmentDetails({
    cwd: "/tmp/pi-cline-real-cwd",
    mode: "ACT MODE",
    includeWorkspaceSnapshot: false,
    currentTime: "3/11/2026, 2:26:47 AM (UTC, UTC+0:00)",
    promptRuntimeInfo,
    contextMessages: [],
  });

  assert.ok(
    text.includes("# Current Time\n3/11/2026, 2:26:47 AM (UTC, UTC+0:00)\n"),
  );
});

test("environment details format generated current time with timezone info", () => {
  const text = buildEnvironmentDetails({
    cwd: "/tmp/pi-cline-real-cwd",
    mode: "ACT MODE",
    includeWorkspaceSnapshot: false,
    promptRuntimeInfo,
    contextMessages: [],
  });

  assert.match(text, /# Current Time\n.+ \([^\n]+, UTC[+-][0-9.]+:00\)\n/);
});

test("environment details include workspace configuration and detected cli tools", () => {
  const text = buildEnvironmentDetails({
    cwd: "/tmp/pi-cline-real-cwd",
    mode: "ACT MODE",
    includeWorkspaceSnapshot: true,
    currentTime: "3/11/2026, 2:26:47 AM",
    promptRuntimeInfo,
    contextMessages: [],
  });

  assert.ok(text.includes("# Workspace Configuration"));
  assert.ok(text.includes("https://github.com/example/repo.git"));
  assert.ok(text.includes("1234567890abcdef1234567890abcdef12345678"));
  assert.ok(text.includes("git, node, npm"));
});

test("workspace configuration serialization uses a stable field order", () => {
  const text = buildEnvironmentDetails({
    cwd: "/tmp/pi-cline-real-cwd",
    mode: "ACT MODE",
    includeWorkspaceSnapshot: true,
    currentTime: "3/11/2026, 2:26:47 AM",
    promptRuntimeInfo: {
      ...promptRuntimeInfo,
      workspaceConfiguration: {
        workspaces: {
          "/tmp/pi-cline-real-cwd": {
            latestGitCommitHash: "1234567890abcdef1234567890abcdef12345678",
            associatedRemoteUrls: [
              "origin: https://github.com/example/repo.git",
            ],
            hint: "pi-cline-real-cwd",
          },
        },
      },
    },
    contextMessages: [],
  });

  const workspaceSectionStart = text.indexOf("# Workspace Configuration\n{");
  assert.notEqual(workspaceSectionStart, -1);

  const workspaceSection = text.slice(
    workspaceSectionStart,
    text.indexOf("\n\n# Detected CLI Tools"),
  );

  assert.match(
    workspaceSection,
    /"hint": "pi-cline-real-cwd",\n\s+"associatedRemoteUrls": \[\n\s+"origin: https:\/\/github.com\/example\/repo.git"\n\s+\],\n\s+"latestGitCommitHash": "1234567890abcdef1234567890abcdef12345678"/,
  );
});

test("environment details omit detected cli tools when none are available", () => {
  const text = buildEnvironmentDetails({
    cwd: "/tmp/pi-cline-real-cwd",
    mode: "ACT MODE",
    includeWorkspaceSnapshot: true,
    currentTime: "3/11/2026, 2:26:47 AM",
    promptRuntimeInfo: {
      ...promptRuntimeInfo,
      detectedCliTools: [],
    },
    contextMessages: [],
  });

  assert.ok(!text.includes("# Detected CLI Tools"));
});

test("task resumption text includes the real cwd instead of /workspace", () => {
  const cwd = "/tmp/pi-cline-real-cwd";
  const message = buildTaskUserMessage("continue", {
    cwd,
    mode: "ACT MODE",
    includeWorkspaceSnapshot: false,
    promptRuntimeInfo,
    contextMessages: [],
    isInitialTurn: false,
  });

  const firstBlock = Array.isArray(message.content)
    ? message.content[0]
    : undefined;
  assert.equal(firstBlock?.type, "text");
  assert.ok(
    (firstBlock?.text || "").includes(
      `The current working directory is now '${cwd}'.`,
    ),
  );
  assert.ok(!(firstBlock?.text || "").includes("'/workspace'"));
});
