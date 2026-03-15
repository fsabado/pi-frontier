import { backoff } from "../lib/backoff";
import {
  CLINE_RECOMMENDED_MODELS_URL,
  CLINE_RETRY_COUNT,
  CLINE_RETRY_DELAY_MS,
} from "../lib/env";

export interface ClineRecommendedModel {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

export interface ClineRecommendedModelsData {
  recommended: ClineRecommendedModel[];
  free: ClineRecommendedModel[];
}

export async function fetchRecommendedModels(): Promise<ClineRecommendedModelsData> {
  return backoff(
    async () => {
      const response = await fetch(CLINE_RECOMMENDED_MODELS_URL, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(
          `Recommended models request failed: ${response.status} ${response.statusText}`,
        );
      }

      const models = (await response.json()) as ClineRecommendedModelsData;
      if (!models || !models.free) {
        throw new Error("Invalid recommended models response");
      }

      return models;
    },
    { retries: CLINE_RETRY_COUNT, delayMs: CLINE_RETRY_DELAY_MS },
  );
}
