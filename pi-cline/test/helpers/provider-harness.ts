import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  ExtensionAPI,
  ExtensionContext,
  ToolDefinition,
} from "@mariozechner/pi-coding-agent";

export interface ToolCallBlock {
  type: "toolCall";
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface TextBlock {
  type: "text";
  text?: string;
}

type AssistantBlock =
  | ToolCallBlock
  | TextBlock
  | { type: string; text?: string };

export interface AssistantMessageLike {
  content: AssistantBlock[];
}

interface ErrorStreamEvent {
  type: "error";
  error: { errorMessage?: string };
}

interface DoneStreamEvent {
  type: "done";
  message: AssistantMessageLike;
}

type StreamEvent =
  | ErrorStreamEvent
  | DoneStreamEvent
  | { type: string; [key: string]: unknown };

type ToolInfo = {
  name: string;
  description: string;
  parameters: unknown;
};

export interface RegisteredProviderConfig {
  streamSimple: (...args: unknown[]) => AsyncIterable<StreamEvent>;
  authHeader?: boolean;
  oauth?: {
    name: string;
    login: (...args: unknown[]) => Promise<unknown>;
    refreshToken: (...args: unknown[]) => Promise<unknown>;
    getApiKey: (...args: unknown[]) => string;
  };
  models: Array<{
    id: string;
    provider: string;
    api: string;
    maxTokens: number;
  }>;
}

export interface RecordedFixture {
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: {
      messages: Array<{
        role: string;
        content: string | Array<{ type: string; text?: string }>;
      }>;
      [key: string]: unknown;
    };
  };
  response: {
    headers: Record<string, string>;
    body: unknown;
  };
}

export interface RequestCapture {
  url: string;
  body: RecordedFixture["request"]["body"];
}

export interface TestConversationContext {
  messages: Array<Record<string, unknown>>;
  tools: ToolInfo[];
}

interface MockPi {
  api: ExtensionAPI;
  getProviderConfig(): RegisteredProviderConfig;
  getToolDefinitions(): Map<string, ToolDefinition>;
  getToolInfos(): ToolInfo[];
}

const builtInToolInfos: ToolInfo[] = [
  {
    name: "read",
    description: "Read a file",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "write",
    description: "Write a file",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "edit",
    description: "Edit a file",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "bash",
    description: "Execute a bash command",
    parameters: { type: "object", properties: {}, required: [] },
  },
];

export function loadJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

export function createMockPi(): MockPi {
  let providerConfig: RegisteredProviderConfig | null = null;
  const toolDefinitions = new Map<string, ToolDefinition>();

  const api = {
    on() {},
    appendEntry() {},
    registerProvider(_name: string, config: RegisteredProviderConfig) {
      providerConfig = config;
    },
    registerTool(tool: ToolDefinition) {
      toolDefinitions.set(tool.name, tool);
    },
  } as unknown as ExtensionAPI;

  return {
    api,
    getProviderConfig() {
      if (!providerConfig) {
        throw new Error("Provider was not registered");
      }
      return providerConfig;
    },
    getToolDefinitions() {
      return new Map(toolDefinitions);
    },
    getToolInfos() {
      return Array.from(toolDefinitions.values()).map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }));
    },
  };
}

function createSseResponse(body: unknown): Response {
  const encoder = new TextEncoder();
  const chunks = Array.isArray(body) ? body : [body];
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
        );
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

export function createMockResponseFromAssistantText(rawText: string): Response {
  return createSseResponse([
    {
      id: `mock-${Date.now()}`,
      choices: [
        { index: 0, delta: { role: "assistant" }, finish_reason: null },
      ],
    },
    {
      id: `mock-${Date.now()}`,
      choices: [{ index: 0, delta: { content: rawText }, finish_reason: null }],
    },
    {
      id: `mock-${Date.now()}`,
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 20,
        prompt_tokens_details: { cached_tokens: 0 },
      },
    },
  ]);
}

export function recordedFixtureResponse(responseBody: unknown): Response {
  return createSseResponse(responseBody);
}

export function extractPrimaryText(message: {
  role: string;
  content: string | Array<{ type: string; text?: string }>;
}) {
  if (typeof message.content === "string") {
    return { role: message.role, text: message.content };
  }

  const firstText = message.content.find(
    (block) => block.type === "text" && typeof block.text === "string",
  );
  return { role: message.role, text: firstText?.text || "" };
}

export function extractAssistantContents(fixture: RecordedFixture): string[] {
  return fixture.request.body.messages
    .filter((message) => message.role === "assistant")
    .map((message) => {
      assert.equal(typeof message.content, "string");
      return message.content as string;
    });
}

function createToolInfoList(extraTools: ToolInfo[] = []) {
  const tools = [...builtInToolInfos];

  for (const tool of extraTools) {
    const index = tools.findIndex((entry) => entry.name === tool.name);
    if (index >= 0) {
      tools[index] = tool;
    } else {
      tools.push(tool);
    }
  }

  return tools;
}

export function createTestContext(
  extraTools: ToolInfo[] = [],
): TestConversationContext {
  return {
    messages: [],
    tools: createToolInfoList(extraTools),
  };
}

export function requireValue<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    assert.fail(message);
  }
  return value;
}

export function findTextBlock(message: AssistantMessageLike) {
  return message.content.find(
    (block): block is TextBlock => block.type === "text",
  )?.text;
}

async function collectAssistantMessage(stream: AsyncIterable<StreamEvent>) {
  let finalMessage: AssistantMessageLike | null = null;

  for await (const event of stream) {
    if (event.type === "error") {
      const errorEvent = event as ErrorStreamEvent;
      throw new Error(errorEvent.error.errorMessage || "Unknown stream error");
    }
    if (event.type === "done") {
      finalMessage = (event as DoneStreamEvent).message;
    }
  }

  if (!finalMessage) {
    throw new Error("No final assistant message received");
  }

  return finalMessage;
}

function toolResult(toolCall: ToolCallBlock, text: string, isError = false) {
  return {
    role: "toolResult",
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    content: [{ type: "text", text }],
    isError,
    timestamp: Date.now(),
  };
}

async function executeLocalTool(
  workspaceDir: string,
  toolCall: ToolCallBlock,
  toolDefinitions: Map<string, ToolDefinition>,
) {
  switch (toolCall.name) {
    case "write": {
      const filePath = path.join(workspaceDir, String(toolCall.arguments.path));
      mkdirSync(path.dirname(filePath), { recursive: true });
      writeFileSync(filePath, String(toolCall.arguments.content || ""), "utf8");
      return toolResult(toolCall, "");
    }

    case "read": {
      const filePath = path.join(workspaceDir, String(toolCall.arguments.path));
      return toolResult(toolCall, readFileSync(filePath, "utf8"));
    }

    case "edit": {
      const filePath = path.join(workspaceDir, String(toolCall.arguments.path));
      const currentContent = readFileSync(filePath, "utf8");
      const oldText = String(toolCall.arguments.oldText || "");
      const newText = String(toolCall.arguments.newText || "");

      if (!currentContent.includes(oldText)) {
        return toolResult(toolCall, "Old text not found", true);
      }

      writeFileSync(filePath, currentContent.replace(oldText, newText), "utf8");
      return toolResult(toolCall, "");
    }

    case "bash": {
      const command = String(toolCall.arguments.command || "");
      const result = await new Promise<{
        code: number;
        stderr: string;
        stdout: string;
      }>((resolve) => {
        const child = spawn("bash", ["-lc", command], {
          cwd: workspaceDir,
          stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk: Buffer) => {
          stdout += chunk.toString();
        });
        child.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString();
        });
        child.on("close", (code) => {
          resolve({ code: code ?? 1, stderr, stdout });
        });
      });

      return toolResult(
        toolCall,
        result.stdout || result.stderr,
        result.code !== 0,
      );
    }

    default: {
      const tool = toolDefinitions.get(toolCall.name);
      if (!tool) {
        throw new Error(`Unsupported local tool: ${toolCall.name}`);
      }

      try {
        const result = await tool.execute(
          toolCall.id,
          toolCall.arguments,
          undefined,
          undefined,
          { cwd: workspaceDir } as ExtensionContext,
        );

        return {
          role: "toolResult",
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          content: result.content,
          details: result.details,
          isError: "isError" in result ? result.isError === true : false,
          timestamp: Date.now(),
        };
      } catch (error) {
        return toolResult(
          toolCall,
          error instanceof Error ? error.message : String(error),
          true,
        );
      }
    }
  }
}

export async function runTurn(options: {
  provider: RegisteredProviderConfig;
  workspaceDir: string;
  modelId: string;
  prompt: string;
  responses: Response[];
  requestCapture: RequestCapture[];
  context: TestConversationContext;
  toolDefinitions?: Map<string, ToolDefinition>;
}) {
  const {
    provider,
    workspaceDir,
    modelId,
    prompt,
    responses,
    requestCapture,
    context,
    toolDefinitions = new Map(),
  } = options;

  context.messages.push({
    role: "user",
    content: prompt,
    timestamp: Date.now(),
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    const body = typeof init?.body === "string" ? init.body : "{}";
    requestCapture.push({
      url: String(url),
      body: JSON.parse(body),
    });

    const response = responses.shift();
    if (!response) {
      throw new Error("No more mocked responses queued");
    }

    return response;
  }) as typeof fetch;

  const previousCwd = process.cwd();
  process.chdir(workspaceDir);

  try {
    while (true) {
      const model = provider.models.find((entry) => entry.id === modelId);
      if (!model) {
        throw new Error(`Unknown model: ${modelId}`);
      }

      const assistant = await collectAssistantMessage(
        provider.streamSimple(
          model,
          {
            messages: context.messages,
            tools: context.tools,
          },
          {
            apiKey: "test-token",
            sessionId: "test-session",
          },
        ),
      );

      context.messages.push(assistant as unknown as Record<string, unknown>);

      const toolCalls = assistant.content.filter(
        (block): block is ToolCallBlock => block.type === "toolCall",
      );
      if (toolCalls.length === 0) {
        return assistant;
      }

      for (const toolCall of toolCalls) {
        const result = await executeLocalTool(
          workspaceDir,
          toolCall,
          toolDefinitions,
        );
        context.messages.push(result as Record<string, unknown>);
      }
    }
  } finally {
    process.chdir(previousCwd);
    globalThis.fetch = originalFetch;
  }
}
