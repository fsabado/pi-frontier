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
import {
  buildBranchReferenceFilter,
  loadSessionState,
  saveSessionState,
} from "./provider/session-disk-state";
import { createStateStore } from "./provider/state";
import { streamCline } from "./provider/stream";

export default function registerClineProvider(pi: ExtensionAPI) {
  let lastContext: ExtensionContext | null = null;
  let currentSessionId: string | null = null;
  const state = createStateStore((type, data) => {
    pi.appendEntry(type, data);
  });

  const refreshState = async (ctx: ExtensionContext) => {
    lastContext = ctx;
    currentSessionId = ctx.sessionManager.getSessionId();
    state.resetFromContext(ctx);

    try {
      const snapshot = await loadSessionState(currentSessionId);
      state.importSnapshot(snapshot, buildBranchReferenceFilter(ctx));
    } catch {}
  };

  const refreshModels = () => {
    void updateCachedPiModelsIfStale().catch(() => {});
  };

  const rememberContext = async (_event: unknown, ctx: ExtensionContext) => {
    lastContext = ctx;
    currentSessionId = ctx.sessionManager.getSessionId();
  };

  pi.on("before_agent_start", rememberContext);
  pi.on("agent_start", rememberContext);

  pi.on("session_start", async (_event, ctx) => {
    await refreshState(ctx);
    refreshModels();
  });

  pi.on("session_switch", async (_event, ctx) => {
    await refreshState(ctx);
    refreshModels();
  });

  pi.on("session_tree", async (_event, ctx) => {
    await refreshState(ctx);
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
          getSessionId: () => currentSessionId || "default",
          persistState: async (sessionId) => {
            await saveSessionState(sessionId, state.exportSnapshot());
          },
          state,
        },
        model,
        context,
        options,
      ),
  });
}
