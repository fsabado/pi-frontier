import fs from "node:fs";
import path from "node:path";
import type { ToolResultMessage } from "@mariozechner/pi-ai";

export function getResultText(result: ToolResultMessage) {
  return result.content
    .map((block) =>
      block.type === "text" ? block.text : `[${block.mimeType} image]`,
    )
    .join("\n")
    .trim();
}

export function readFinalFileContent(filePath: string, cwd: string) {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(cwd, filePath);

  try {
    return fs.readFileSync(absolutePath, "utf8");
  } catch {
    return undefined;
  }
}
