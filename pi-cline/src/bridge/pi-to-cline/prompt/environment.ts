import fs from "node:fs";
import path from "node:path";
import type { PromptRuntimeInfo } from "./runtime-info";

export interface EnvironmentDetailsOptions {
  cwd: string;
  mode: "ACT MODE" | "PLAN MODE";
  includeWorkspaceSnapshot: boolean;
  currentTime?: string;
  promptRuntimeInfo?: PromptRuntimeInfo;
  commandContext?: {
    command: string;
    output: string;
  };
  contextMessages?: unknown[];
  contextWindow?: number;
}

function listWorkspaceFiles(cwd: string) {
  const entries: string[] = [];

  const visit = (directoryPath: string, prefix = "", depth = 0) => {
    if (depth > 3) {
      return;
    }

    let directoryEntries: fs.Dirent[] = [];
    try {
      directoryEntries = fs.readdirSync(directoryPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of directoryEntries.sort((left, right) =>
      left.name.localeCompare(right.name),
    )) {
      if ([".git", ".pi", "node_modules"].includes(entry.name)) {
        continue;
      }

      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      entries.push(relativePath);
      if (entry.isDirectory()) {
        visit(path.join(directoryPath, entry.name), relativePath, depth + 1);
      }
    }
  };

  visit(cwd);
  return entries;
}

function estimateContextUsage(
  messages: unknown[] | undefined,
  contextWindow: number,
) {
  const estimatedTokens = Math.ceil(JSON.stringify(messages || []).length / 4);
  const contextWindowK = Math.round(contextWindow / 1_000);
  const percent = Math.min(
    100,
    Math.round((estimatedTokens / contextWindow) * 100),
  );
  return `${estimatedTokens.toLocaleString()} / ${contextWindowK}K tokens used (${percent}%)`;
}

export function formatEnvironmentCurrentTime(date: Date): string {
  const formatter = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: true,
  });
  const timeZone = formatter.resolvedOptions().timeZone;
  const timeZoneOffset = -date.getTimezoneOffset() / 60;
  const timeZoneOffsetStr = `${timeZoneOffset >= 0 ? "+" : ""}${timeZoneOffset}:00`;
  return `${formatter.format(date)} (${timeZone}, UTC${timeZoneOffsetStr})`;
}

function getCurrentTimeText(options: EnvironmentDetailsOptions) {
  return options.currentTime || formatEnvironmentCurrentTime(new Date());
}

function getDisplayCwd(cwd: string) {
  return cwd.trim() || process.cwd();
}

function getDetectedCliTools(options: EnvironmentDetailsOptions) {
  return options.promptRuntimeInfo?.detectedCliTools ?? [];
}

function getWorkspaceConfigurationText(options: EnvironmentDetailsOptions) {
  const config = options.promptRuntimeInfo?.workspaceConfiguration;
  if (!config) {
    return undefined;
  }

  const orderedWorkspaces = Object.fromEntries(
    Object.entries(config.workspaces)
      .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
      .map(([workspacePath, workspace]) => [
        workspacePath,
        {
          hint: workspace.hint,
          ...(workspace.associatedRemoteUrls
            ? { associatedRemoteUrls: workspace.associatedRemoteUrls }
            : {}),
          ...(workspace.latestGitCommitHash
            ? { latestGitCommitHash: workspace.latestGitCommitHash }
            : {}),
        },
      ]),
  );

  return JSON.stringify({ workspaces: orderedWorkspaces }, null, 2);
}

export function buildEnvironmentDetails(options: EnvironmentDetailsOptions) {
  const displayCwd = getDisplayCwd(options.cwd);
  const sections = [
    "# Cline CLI - Node.js Visible Files",
    "(No visible files)",
    "",
    "# Cline CLI - Node.js Open Tabs",
    "(No open tabs)",
    "",
  ];

  if (options.commandContext) {
    sections.push(
      "# Inactive Terminals",
      `## ${options.commandContext.command}`,
      "### New Output",
      options.commandContext.output || "(no output)",
      "",
    );
  }

  sections.push("# Current Time", getCurrentTimeText(options), "");

  if (options.includeWorkspaceSnapshot) {
    const files = listWorkspaceFiles(options.cwd);
    const workspaceConfigurationText = getWorkspaceConfigurationText(options);

    sections.push(
      `# Current Working Directory (${displayCwd}) Files`,
      ...(files.length > 0 ? files : ["(empty workspace)"]),
      "",
    );

    if (workspaceConfigurationText) {
      sections.push(
        "# Workspace Configuration",
        workspaceConfigurationText,
        "",
      );
    }

    const detectedCliTools = getDetectedCliTools(options);
    if (detectedCliTools.length > 0) {
      sections.push(
        "# Detected CLI Tools",
        `These are some of the tools on the user's machine, and may be useful if needed to accomplish the task: ${detectedCliTools.join(", ")}. This list is not exhaustive, and other tools may be available.`,
        "",
      );
    }
  }

  sections.push(
    "# Context Window Usage",
    estimateContextUsage(
      options.contextMessages,
      options.contextWindow ?? 200_000,
    ),
    "",
    "# Current Mode",
    options.mode,
  );

  return `<environment_details>\n${sections.join("\n")}\n</environment_details>`;
}

export { getDisplayCwd };
