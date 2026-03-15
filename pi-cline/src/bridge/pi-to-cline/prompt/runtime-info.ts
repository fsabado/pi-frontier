import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
export interface PromptWorkspaceConfiguration {
  workspaces: Record<
    string,
    {
      hint: string;
      associatedRemoteUrls?: string[];
      latestGitCommitHash?: string;
    }
  >;
}

export interface PromptRuntimeInfo {
  operatingSystem: string;
  ide: string;
  defaultShell: string;
  homeDirectory: string;
  currentWorkingDirectory: string;
  detectedCliTools: string[];
  workspaceConfiguration: PromptWorkspaceConfiguration;
}

const ide = "Cline CLI - Node.js";
export const detectedToolCandidates = [
  "gh",
  "git",
  "docker",
  "kubectl",
  "aws",
  "gcloud",
  "npm",
  "curl",
  "jq",
  "make",
  "node",
  "sqlite3",
  "grep",
  "sed",
  "awk",
  "bundle",
];

function getOperatingSystem() {
  return os.version() || `${os.type()} ${os.release()}`;
}

function getDefaultShell() {
  return process.env.SHELL || process.env.ComSpec || "unknown";
}

function isExecutable(filePath: string) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function hasCommandOnPath(command: string) {
  const pathValue = process.env.PATH || "";
  const dirs = pathValue.split(path.delimiter).filter(Boolean);
  const exts =
    process.platform === "win32"
      ? (process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM")
          .split(";")
          .filter(Boolean)
      : [""];

  return dirs.some((dir) =>
    exts.some((ext) => isExecutable(path.join(dir, `${command}${ext}`))),
  );
}

function getDetectedCliTools() {
  return detectedToolCandidates.filter(hasCommandOnPath);
}

function runGit(cwd: string, args: string[]) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  if (result.status !== 0) {
    return undefined;
  }

  const value = result.stdout.trim();
  return value.length > 0 ? value : undefined;
}

function getWorkspaceHint(cwd: string) {
  const baseName = path.basename(cwd);
  return baseName.length > 0 ? baseName : "workspace";
}

function getWorkspaceConfiguration(cwd: string) {
  const remoteUrl = runGit(cwd, ["remote", "get-url", "origin"]);
  const latestGitCommitHash = runGit(cwd, ["rev-parse", "HEAD"]);
  const workspace = {
    hint: getWorkspaceHint(cwd),
    ...(remoteUrl ? { associatedRemoteUrls: [`origin: ${remoteUrl}`] } : {}),
    ...(latestGitCommitHash ? { latestGitCommitHash } : {}),
  };

  return {
    workspaces: {
      [cwd]: workspace,
    },
  };
}

export function collectPromptRuntimeInfo(cwd: string): PromptRuntimeInfo {
  return {
    operatingSystem: getOperatingSystem(),
    ide,
    defaultShell: getDefaultShell(),
    homeDirectory: os.homedir(),
    currentWorkingDirectory: cwd,
    detectedCliTools: getDetectedCliTools(),
    workspaceConfiguration: getWorkspaceConfiguration(cwd),
  };
}
