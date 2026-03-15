import type { Api, Context, Model } from "@mariozechner/pi-ai";
import type {
  ClineChatCompletionRequest,
  ClineRequestHeaders,
} from "../../api/cline-chat";
import {
  CLINE_CLIENT_VERSION,
  CLINE_CORE_VERSION,
  CLINE_HTTP_REFERER,
} from "../../lib/env";
import type { ClineStateStore } from "../../provider/state";
import type { PiToolCapabilities } from "../shared/tool-names";
import { collectPromptRuntimeInfo } from "./prompt/runtime-info";
import { buildClineSystemPrompt } from "./prompt/system";
import { buildClineConversationMessages } from "./request-messages";

const buildClineHeaderSignature = (isMultiRoot: boolean) => ({
  "X-CLIENT-TYPE": "CLI",
  "X-CLIENT-VERSION": CLINE_CLIENT_VERSION,
  "X-CORE-VERSION": CLINE_CORE_VERSION,
  "X-IS-MULTIROOT": isMultiRoot ? "true" : "false",
  "X-PLATFORM": "Cline CLI - Node.js",
  "X-PLATFORM-VERSION": CLINE_CLIENT_VERSION,
  "User-Agent": `Cline/${CLINE_CORE_VERSION}`,
});

const normalizeApiModelId = (modelId: string) =>
  modelId.startsWith("cline/") ? modelId.slice("cline/".length) : modelId;

export function buildClineRequestHeaders(
  sessionId: string,
  isMultiRoot = false,
): ClineRequestHeaders {
  return {
    ...buildClineHeaderSignature(isMultiRoot),
    "HTTP-Referer": CLINE_HTTP_REFERER,
    "X-Task-ID": sessionId,
    "X-Title": "Cline",
  };
}

export function buildClineRequestBody(
  model: Model<Api>,
  context: Context,
  cwd: string,
  state: ClineStateStore,
  capabilities: PiToolCapabilities,
  runtimeInfo = collectPromptRuntimeInfo(cwd),
): ClineChatCompletionRequest {
  return {
    model: normalizeApiModelId(model.id),
    temperature: 0,
    messages: [
      {
        role: "system",
        content: buildClineSystemPrompt(model.id, capabilities, runtimeInfo),
      },
      ...buildClineConversationMessages(
        context,
        cwd,
        state,
        runtimeInfo,
        model.contextWindow,
      ),
    ],
    stream: true,
    stream_options: { include_usage: true },
    include_reasoning: true,
  };
}
