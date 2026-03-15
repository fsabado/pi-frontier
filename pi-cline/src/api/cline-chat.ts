import OpenAI from "openai";
import { APIError, APIUserAbortError } from "openai/error";
import type {
  ChatCompletionChunk,
  ChatCompletionCreateParamsStreaming,
} from "openai/resources/chat/completions";
import { backoff } from "../lib/backoff";
import {
  CLINE_API_BASE_URL,
  CLINE_REQUEST_TIMEOUT_MS,
  CLINE_RETRY_COUNT,
  CLINE_RETRY_DELAY_MS,
} from "../lib/env";

export interface ClineChatMessage {
  role: "assistant" | "system" | "tool" | "user";
  content: string | Array<{ type: "text"; text: string }>;
}

export interface ClineChatCompletionRequest {
  model: string;
  temperature: number;
  messages: ClineChatMessage[];
  stream: true;
  stream_options: { include_usage: true };
  include_reasoning: true;
}

export type ClineRequestHeaders = Record<string, string>;

interface ClineChunkError {
  message?: string;
  code?: string;
  metadata?: unknown;
}

type ClineChatCompletionChoice = Omit<
  ChatCompletionChunk.Choice,
  "delta" | "finish_reason"
> & {
  delta: ChatCompletionChunk.Choice.Delta & {
    reasoning?: string | null;
  };
  finish_reason: ChatCompletionChunk.Choice["finish_reason"] | "error";
  error?: ClineChunkError;
};

export interface ClineChatCompletionChunk
  extends Omit<ChatCompletionChunk, "choices"> {
  error?: ClineChunkError;
  choices: ClineChatCompletionChoice[];
}

export interface CreateChatCompletionStreamArgs {
  apiKey: string;
  headers: ClineRequestHeaders;
  body: ClineChatCompletionRequest;
  signal?: AbortSignal;
}

export interface ClineChatTransport {
  createChatCompletionStream(
    args: CreateChatCompletionStreamArgs,
  ): Promise<AsyncIterable<ClineChatCompletionChunk>>;
}

const createClient = (apiKey: string, headers: ClineRequestHeaders) =>
  new OpenAI({
    apiKey,
    baseURL: CLINE_API_BASE_URL,
    defaultHeaders: headers,
    maxRetries: 0,
    timeout: CLINE_REQUEST_TIMEOUT_MS,
  });

function shouldRetryRequest(error: unknown) {
  if (error instanceof APIUserAbortError) {
    return false;
  }

  if (!(error instanceof APIError)) {
    return true;
  }

  const status = error.status;
  return status === undefined || status === 429 || status >= 500;
}

export const defaultClineChatTransport: ClineChatTransport = {
  async createChatCompletionStream({ apiKey, body, headers, signal }) {
    return backoff(
      async () => {
        const client = createClient(apiKey, headers);
        return await client.chat.completions.create(
          body as ChatCompletionCreateParamsStreaming,
          { signal, maxRetries: 0, timeout: CLINE_REQUEST_TIMEOUT_MS },
        );
      },
      {
        retries: CLINE_RETRY_COUNT,
        delayMs: CLINE_RETRY_DELAY_MS,
        shouldRetry: (error) => !signal?.aborted && shouldRetryRequest(error),
      },
    );
  },
};
