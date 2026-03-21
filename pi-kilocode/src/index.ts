import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { KILO_GATEWAY_BASE_URL } from "./lib/env.js";
import {
  getCachedPiModels,
  updateCachedPiModelsIfStale,
} from "./provider/models.js";
import {
  getApiKey,
  login,
  modifyModels,
  refreshToken,
} from "./provider/oauth.js";

export default function registerKilocodeProvider(pi: ExtensionAPI) {
  const refreshModels = () => {
    void updateCachedPiModelsIfStale().catch(() => {});
  };

  pi.on("session_start", async () => refreshModels());
  pi.on("session_switch", async () => refreshModels());
  pi.on("model_select", async (event) => {
    if (event.model.provider === "kilocode") {
      refreshModels();
    }
  });

  pi.registerProvider("kilocode", {
    baseUrl: KILO_GATEWAY_BASE_URL,
    apiKey: "KILO_API_KEY",
    api: "openai-completions",
    authHeader: false,
    headers: { "X-KILOCODE-EDITORNAME": "pi" },
    models: getCachedPiModels(),
    oauth: { name: "Kilo Code", login, refreshToken, getApiKey, modifyModels },
  });
}
