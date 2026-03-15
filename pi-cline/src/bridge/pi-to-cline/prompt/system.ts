import type { PiToolCapabilities } from "../../shared/tool-names";
import type { PromptRuntimeInfo } from "./runtime-info";
import {
  type ClinePromptFamily,
  renderClineSystemPromptTemplate,
} from "./system/templates";

function isTrinityModelFamily(modelId: string): boolean {
  return modelId.includes("trinity");
}

function resolvePromptFamily(modelId: string): ClinePromptFamily {
  if (isTrinityModelFamily(modelId)) {
    return "trinity";
  }

  return "generic";
}

export function buildClineSystemPrompt(
  modelId: string,
  _capabilities: PiToolCapabilities,
  runtimeInfo: PromptRuntimeInfo,
) {
  return renderClineSystemPromptTemplate(
    resolvePromptFamily(modelId),
    runtimeInfo,
  );
}
