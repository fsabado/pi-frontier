import fs from "node:fs";
import type { Api, Model } from "@mariozechner/pi-ai";
import { getModel } from "@mariozechner/pi-ai";
import type {
  ClineRecommendedModel,
  ClineRecommendedModelsData,
} from "../api/recommended-models";
import { fetchRecommendedModels } from "../api/recommended-models";
import {
  CLINE_API_BASE_URL,
  PI_CLINE_CACHE_DIR,
  PI_CLINE_MODELS_CACHE_FILE,
  PI_CLINE_MODELS_CACHE_TTL_MS,
} from "../lib/env";

interface CachedModelsFile {
  data: ClineRecommendedModelsData;
  lastUpdatedAt?: string;
}

interface ModelDefaults {
  contextWindow: number;
  maxTokens: number;
  input: ("image" | "text")[];
  reasoning: boolean;
}

let updateInFlight: Promise<void> | null = null;

const stripProviderPrefix = (modelId: string) =>
  modelId.startsWith("cline/") ? modelId.slice("cline/".length) : modelId;

const isRecommendedModel = (value: unknown): value is ClineRecommendedModel => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const model = value as Partial<ClineRecommendedModel>;
  return (
    typeof model.id === "string" &&
    typeof model.name === "string" &&
    typeof model.description === "string" &&
    Array.isArray(model.tags) &&
    model.tags.every((tag) => typeof tag === "string")
  );
};

const isCachedModelsFile = (value: unknown): value is CachedModelsFile => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const cache = value as Partial<CachedModelsFile> & {
    data?: Partial<ClineRecommendedModelsData>;
  };
  const { data } = cache;

  if (!data || !Array.isArray(data.recommended) || !Array.isArray(data.free)) {
    return false;
  }
  if (!data.recommended.every(isRecommendedModel)) {
    return false;
  }
  if (!data.free.every(isRecommendedModel)) {
    return false;
  }

  return (
    cache.lastUpdatedAt === undefined || typeof cache.lastUpdatedAt === "string"
  );
};

function readCache(): CachedModelsFile | undefined {
  try {
    if (!fs.existsSync(PI_CLINE_MODELS_CACHE_FILE)) {
      return undefined;
    }

    const cache = JSON.parse(
      fs.readFileSync(PI_CLINE_MODELS_CACHE_FILE, "utf8"),
    ) as unknown;
    return isCachedModelsFile(cache) ? cache : undefined;
  } catch {
    return undefined;
  }
}

function isCacheStale(cache: CachedModelsFile | undefined) {
  if (!cache?.lastUpdatedAt) {
    return true;
  }

  const lastUpdatedAt = Date.parse(cache.lastUpdatedAt);
  return (
    Number.isNaN(lastUpdatedAt) ||
    Date.now() - lastUpdatedAt >= PI_CLINE_MODELS_CACHE_TTL_MS
  );
}

function getModelDefaults(modelId: string): ModelDefaults {
  // biome-ignore lint/suspicious/noExplicitAny: model ID is dynamic from Cline API
  const model = getModel("openrouter", modelId as any);
  if (model) {
    return {
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
      input: [...model.input],
      reasoning: model.reasoning,
    };
  }
  return {
    contextWindow: 200_000,
    maxTokens: 30_000,
    input: ["text", "image"],
    reasoning: false,
  };
}

function toPiModel(model: ClineRecommendedModel): Model<Api> {
  const modelId = stripProviderPrefix(model.id);
  const defaults = getModelDefaults(modelId);
  return {
    id: modelId,
    name: `${model.name} (Cline)`,
    api: "cline-chat-completions" as Api,
    provider: "cline",
    baseUrl: CLINE_API_BASE_URL,
    reasoning: defaults.reasoning,
    input: defaults.input,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: defaults.contextWindow,
    maxTokens: defaults.maxTokens,
  };
}

export function getCachedPiModels(): Model<Api>[] {
  return (readCache()?.data.free ?? []).map(toPiModel);
}

async function updateCachedPiModels() {
  const [data] = await Promise.all([
    fetchRecommendedModels(),
    fs.promises.mkdir(PI_CLINE_CACHE_DIR, { recursive: true }),
  ]);

  const cache: CachedModelsFile = {
    data,
    lastUpdatedAt: new Date().toISOString(),
  };

  await fs.promises.writeFile(
    PI_CLINE_MODELS_CACHE_FILE,
    JSON.stringify(cache, null, 2),
  );
}

export async function updateCachedPiModelsIfStale() {
  if (updateInFlight) {
    await updateInFlight;
    return;
  }

  if (!isCacheStale(readCache())) {
    return;
  }

  updateInFlight = updateCachedPiModels().finally(() => {
    updateInFlight = null;
  });

  try {
    await updateInFlight;
  } catch {
    // Ignore refresh failures and keep cached or hardcoded models.
  }
}

export function resetPiClineModelCacheForTests() {
  updateInFlight = null;
}
