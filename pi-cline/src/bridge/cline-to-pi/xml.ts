import { containsSystemMarker } from "../shared/cline-markers";

export interface ParsedAssistantResponse {
  rawText: string;
  thinking: string[];
  preambleText: string;
  toolCalls: Array<{
    name: string;
    parameters: Record<string, string>;
  }>;
}

interface TextBlock {
  type: "text";
  content: string;
}

interface ToolUseBlock {
  type: "tool_use";
  name: string;
  params: Record<string, string>;
}

type AssistantMessageBlock = TextBlock | ToolUseBlock;

const toolUseNames = [
  "access_mcp_resource",
  "act_mode_respond",
  "apply_patch",
  "ask_followup_question",
  "attempt_completion",
  "browser_action",
  "condense",
  "execute_command",
  "generate_explanation",
  "list_code_definition_names",
  "list_files",
  "load_mcp_documentation",
  "new_rule",
  "new_task",
  "plan_mode_respond",
  "read_file",
  "replace_in_file",
  "report_bug",
  "search_files",
  "summarize_task",
  "use_mcp_tool",
  "use_skill",
  "use_subagents",
  "web_fetch",
  "web_search",
  "write_to_file",
] as const;

const toolParamNames = [
  "action",
  "additional_context",
  "allowed_domains",
  "api_request_output",
  "arguments",
  "blocked_domains",
  "command",
  "content",
  "context",
  "coordinate",
  "diff",
  "file_pattern",
  "from_ref",
  "input",
  "needs_more_exploration",
  "options",
  "path",
  "prompt",
  "prompt_1",
  "prompt_2",
  "prompt_3",
  "prompt_4",
  "prompt_5",
  "query",
  "question",
  "recursive",
  "regex",
  "requires_approval",
  "response",
  "result",
  "server_name",
  "skill_name",
  "steps_to_reproduce",
  "task_progress",
  "text",
  "timeout",
  "title",
  "to_ref",
  "tool_name",
  "uri",
  "url",
  "what_happened",
] as const;

const ignorableTopLevelTags = ["task_progress"] as const;

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripCodeFences(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```") || !trimmed.endsWith("```")) {
    return value;
  }

  const lines = trimmed.split(/\r?\n/);
  return lines.slice(1, -1).join("\n");
}

function normalizeParameterValue(value: string) {
  return decodeXmlEntities(stripCodeFences(value).trim());
}

function sanitizeTextContent(value: string) {
  let sanitized = value;

  for (const tagName of ignorableTopLevelTags) {
    sanitized = sanitized.replace(
      new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "g"),
      "",
    );
  }

  return decodeXmlEntities(sanitized).trim();
}

function extractThinkingBlocks(rawText: string) {
  const thinking: string[] = [];
  const remainder = rawText.replace(
    /<thinking>([\s\S]*?)<\/thinking>/g,
    (_match, value: string) => {
      thinking.push(decodeXmlEntities(value.trim()));
      return "";
    },
  );

  return {
    thinking,
    remainder: remainder.trim(),
  };
}

function parseAssistantMessageV2(
  assistantMessage: string,
): AssistantMessageBlock[] {
  const contentBlocks: AssistantMessageBlock[] = [];
  let currentTextStart = 0;
  let currentToolStart = 0;
  let currentParamValueStart = 0;
  let currentTool: ToolUseBlock | undefined;
  let currentParamName: string | undefined;

  const toolOpenTags = new Map<string, string>();
  const toolParamOpenTags = new Map<string, string>();

  for (const name of toolUseNames) {
    toolOpenTags.set(`<${name}>`, name);
  }
  for (const name of toolParamNames) {
    toolParamOpenTags.set(`<${name}>`, name);
  }

  const pushTextBlock = (endIndex: number) => {
    const content = assistantMessage.slice(currentTextStart, endIndex).trim();
    if (content.length > 0) {
      contentBlocks.push({ type: "text", content });
    }
  };

  const len = assistantMessage.length;
  for (let index = 0; index < len; index += 1) {
    if (currentTool && currentParamName) {
      const closeTag = `</${currentParamName}>`;
      if (
        index >= closeTag.length - 1 &&
        assistantMessage.startsWith(closeTag, index - closeTag.length + 1)
      ) {
        currentTool.params[currentParamName] = normalizeParameterValue(
          assistantMessage.slice(
            currentParamValueStart,
            index - closeTag.length + 1,
          ),
        );
        currentParamName = undefined;
      } else {
        continue;
      }
    }

    if (currentTool && !currentParamName) {
      let startedNewParam = false;
      for (const [tag, paramName] of toolParamOpenTags) {
        if (
          index >= tag.length - 1 &&
          assistantMessage.startsWith(tag, index - tag.length + 1)
        ) {
          currentParamName = paramName;
          currentParamValueStart = index + 1;
          startedNewParam = true;
          break;
        }
      }

      if (startedNewParam) {
        continue;
      }

      const toolCloseTag = `</${currentTool.name}>`;
      if (
        index >= toolCloseTag.length - 1 &&
        assistantMessage.startsWith(
          toolCloseTag,
          index - toolCloseTag.length + 1,
        )
      ) {
        const toolContentSlice = assistantMessage.slice(
          currentToolStart,
          index - toolCloseTag.length + 1,
        );

        if (
          (currentTool.name === "write_to_file" ||
            currentTool.name === "new_rule") &&
          toolContentSlice.includes("<content>")
        ) {
          const contentStartTag = "<content>";
          const contentEndTag = "</content>";
          const contentStart = toolContentSlice.indexOf(contentStartTag);
          const contentEnd = toolContentSlice.lastIndexOf(contentEndTag);

          if (
            contentStart !== -1 &&
            contentEnd !== -1 &&
            contentEnd > contentStart
          ) {
            currentTool.params.content = normalizeParameterValue(
              toolContentSlice.slice(
                contentStart + contentStartTag.length,
                contentEnd,
              ),
            );
          }
        }

        contentBlocks.push(currentTool);
        currentTool = undefined;
        currentTextStart = index + 1;
        continue;
      }

      continue;
    }

    if (!currentTool) {
      let startedNewTool = false;
      for (const [tag, toolName] of toolOpenTags) {
        if (
          index >= tag.length - 1 &&
          assistantMessage.startsWith(tag, index - tag.length + 1)
        ) {
          pushTextBlock(index - tag.length + 1);
          currentTool = {
            type: "tool_use",
            name: toolName,
            params: {},
          };
          currentToolStart = index + 1;
          startedNewTool = true;
          break;
        }
      }

      if (startedNewTool) {
      }
    }
  }

  if (currentTool && currentParamName) {
    currentTool.params[currentParamName] = normalizeParameterValue(
      assistantMessage.slice(currentParamValueStart),
    );
  }

  if (currentTool) {
    contentBlocks.push(currentTool);
  } else {
    pushTextBlock(assistantMessage.length);
  }

  return contentBlocks;
}

export function parseAssistantXmlResponse(
  rawText: string,
): ParsedAssistantResponse {
  const { thinking, remainder } = extractThinkingBlocks(rawText);
  const blocks = parseAssistantMessageV2(remainder);

  const preambleText = blocks
    .filter((block): block is TextBlock => block.type === "text")
    .filter((block) => !containsSystemMarker(block.content))
    .map((block) => sanitizeTextContent(block.content))
    .filter(Boolean)
    .join("\n\n")
    .trim();

  const toolCalls = blocks
    .filter((block): block is ToolUseBlock => block.type === "tool_use")
    .map((block) => ({
      name: block.name,
      parameters: block.params,
    }));

  return {
    rawText,
    thinking,
    preambleText,
    toolCalls,
  };
}
