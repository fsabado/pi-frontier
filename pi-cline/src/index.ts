import type { Api } from "@mariozechner/pi-ai";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { CLINE_API_BASE_URL } from "./lib/env";
import {
  getCachedPiModels,
  updateCachedPiModelsIfStale,
} from "./provider/models";
import { getApiKey, login, refreshToken } from "./provider/oauth";
import { createStateStore } from "./provider/state";
import { streamCline } from "./provider/stream";

export default function registerClineProvider(pi: ExtensionAPI) {
  let lastContext: ExtensionContext | null = null;
  const state = createStateStore((type, data) => {
    pi.appendEntry(type, data);
  });

  const refreshState = (ctx: ExtensionContext) => {
    lastContext = ctx;
    state.resetFromContext(ctx);
  };

  const refreshModels = () => {
    void updateCachedPiModelsIfStale().catch(() => {});
  };

  const rememberContext = async (_event: unknown, ctx: ExtensionContext) => {
    lastContext = ctx;
  };

  pi.on("before_agent_start", rememberContext);
  pi.on("agent_start", rememberContext);

  pi.on("session_start", async (_event, ctx) => {
    refreshState(ctx);
    refreshModels();
  });

  pi.on("session_switch", async (_event, ctx) => {
    refreshState(ctx);
    refreshModels();
  });

  pi.on("session_tree", async (_event, ctx) => {
    refreshState(ctx);
  });

  pi.on("model_select", async (event, ctx) => {
    lastContext = ctx;
    if (event.model.provider === "cline") {
      refreshModels();
    }
  });

  pi.registerProvider("cline", {
    baseUrl: CLINE_API_BASE_URL,
    api: "cline-chat-completions" as Api,
    authHeader: false,
    models: getCachedPiModels(),
    oauth: { name: "Cline", login, refreshToken, getApiKey },
    streamSimple: (model, context, options) =>
      streamCline(
        {
          getCwd: () => lastContext?.cwd || process.cwd(),
          state,
        },
        model,
        context,
        options,
      ),
  });
}
