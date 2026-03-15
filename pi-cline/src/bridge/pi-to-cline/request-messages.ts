import type {
  AssistantMessage,
  Context,
  Message,
  ToolResultMessage,
  UserMessage,
} from "@mariozechner/pi-ai";
import type { ClineChatMessage } from "../../api/cline-chat";
import type { ClineStateStore } from "../../provider/state";
import {
  type EnvironmentDetailsOptions,
  formatEnvironmentCurrentTime,
} from "./prompt/environment";
import type { PromptRuntimeInfo } from "./prompt/runtime-info";
import {
  buildTaskUserMessage,
  buildToolResultEnvironmentDetails,
} from "./prompt/task-message";
import {
  buildRemoteToolCallFromRuntimeToolCall,
  serializeRemoteToolCallToXml,
} from "./serialize-tool-call";
import { formatToolResultForCline } from "./tool-result";

const isAssistantMessage = (message: Message): message is AssistantMessage =>
  message.role === "assistant";
const isToolResultMessage = (message: Message): message is ToolResultMessage =>
  message.role === "toolResult";
const isUserMessage = (message: Message): message is UserMessage =>
  message.role === "user";

function getUserMessageText(message: UserMessage) {
  if (typeof message.content === "string") {
    return message.content;
  }

  return message.content
    .map((block) =>
      block.type === "text" ? block.text : `[${block.mimeType} image]`,
    )
    .join("\n");
}

function buildAssistantContent(
  message: AssistantMessage,
  state: ClineStateStore,
  isInterrupted: boolean,
) {
  const rawText = state.getAssistantRaw(message.timestamp);
  if (rawText) {
    return isInterrupted
      ? `${rawText}\n\n[Response interrupted by user]`
      : rawText;
  }

  return message.content
    .map((block) => {
      switch (block.type) {
        case "text":
          return block.text;
        case "thinking":
          return `<thinking>\n${block.thinking}\n</thinking>`;
        case "toolCall": {
          const remoteToolCall = buildRemoteToolCallFromRuntimeToolCall(
            block,
            state.getRemoteToolCall(block.id),
          );
          return serializeRemoteToolCallToXml(
            remoteToolCall.remoteName,
            remoteToolCall.remoteArgs,
          );
        }
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export function buildClineConversationMessages(
  context: Context,
  cwd: string,
  state: ClineStateStore,
  runtimeInfo: PromptRuntimeInfo,
  contextWindow: number,
): ClineChatMessage[] {
  const messages: ClineChatMessage[] = [];
  const promptCurrentTime = state.getOrCreatePromptCurrentTime(() =>
    formatEnvironmentCurrentTime(new Date()),
  );
  let userMessageCount = 0;

  for (const [index, message] of context.messages.entries()) {
    if (isUserMessage(message)) {
      userMessageCount += 1;
      const wrappedMessage = buildTaskUserMessage(getUserMessageText(message), {
        cwd,
        mode: "ACT MODE",
        includeWorkspaceSnapshot: userMessageCount === 1,
        currentTime: promptCurrentTime,
        promptRuntimeInfo: runtimeInfo,
        contextMessages: context.messages,
        contextWindow,
        isInitialTurn: index === 0,
      });

      messages.push({
        role: "user",
        content: wrappedMessage.content as Array<{
          type: "text";
          text: string;
        }>,
      });
      continue;
    }

    if (isAssistantMessage(message)) {
      messages.push({
        role: "assistant",
        content: buildAssistantContent(
          message,
          state,
          context.messages[index + 1]?.role === "user",
        ),
      });
      continue;
    }

    if (isToolResultMessage(message)) {
      const remoteMeta = state.getRemoteToolCall(message.toolCallId);
      const toolResultText = formatToolResultForCline(remoteMeta, message, cwd);

      const isCommandResult = remoteMeta?.remoteName === "execute_command";
      const commandContext = isCommandResult
        ? {
            command:
              typeof remoteMeta.remoteArgs.command === "string"
                ? remoteMeta.remoteArgs.command
                : "",
            output: toolResultText,
          }
        : undefined;

      const envOptions: EnvironmentDetailsOptions = {
        cwd,
        mode: "ACT MODE",
        includeWorkspaceSnapshot: false,
        contextMessages: context.messages,
        contextWindow,
        promptRuntimeInfo: runtimeInfo,
        currentTime: promptCurrentTime,
      };
      if (commandContext) {
        envOptions.commandContext = commandContext;
      }
      const envDetails = buildToolResultEnvironmentDetails(envOptions);

      messages.push({
        role: "user",
        content: [
          { type: "text", text: toolResultText },
          { type: "text", text: envDetails },
        ],
      });
    }
  }

  return messages;
}
