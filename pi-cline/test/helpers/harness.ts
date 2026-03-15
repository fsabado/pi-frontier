import { realpathSync } from "node:fs";
import registerClineProvider from "../../src/index";
import { createMockPi, createTestContext } from "./provider-harness";

export function createProviderHarness() {
  const pi = createMockPi();
  registerClineProvider(pi.api);

  return {
    context: createTestContext(pi.getToolInfos()),
    pi,
    provider: pi.getProviderConfig(),
  };
}

export function stripClineProviderPrefix(modelId: string) {
  return modelId.startsWith("cline/")
    ? modelId.slice("cline/".length)
    : modelId;
}

export function rewriteFixtureWorkspacePath(
  text: string,
  workspaceDir: string,
) {
  return text.replaceAll("/workspace", realpathSync(workspaceDir));
}
