import os from "node:os";
import path from "node:path";

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const piCodingAgentDir =
  process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), ".pi", "agent");
const piClineCacheDir = path.join(piCodingAgentDir, "cache", "pi-cline");

export const CLINE_API_BASE_URL = "https://api.cline.bot/api/v1";
export const CLINE_RECOMMENDED_MODELS_URL = `${CLINE_API_BASE_URL}/ai/cline/recommended-models`;
export const CLINE_HTTP_REFERER = "https://cline.bot";
export const CLINE_CLIENT_VERSION = "2.7.0";
export const CLINE_CORE_VERSION = "3.72.0";
export const CLINE_AUTH_CLIENT_TYPE = "CLI";
export const CLINE_AUTH_PLATFORM = "Cline CLI - Node.js";
export const CLINE_REQUEST_TIMEOUT_MS = 10 * 60 * 1000;
export const CLINE_RETRY_COUNT = 8;
export const CLINE_RETRY_DELAY_MS = 2_000;

export const PI_CODING_AGENT_DIR = piCodingAgentDir;
export const PI_CLINE_CACHE_DIR = piClineCacheDir;
export const PI_CLINE_MODELS_CACHE_FILE =
  process.env.PI_CLINE_MODELS_CACHE_FILE ||
  path.join(piClineCacheDir, "models.json");
export const PI_CLINE_MODELS_CACHE_TTL_MS = parsePositiveInteger(
  process.env.PI_CLINE_MODELS_CACHE_TTL_MS,
  60 * 60 * 1000,
);
