import type { Message } from "@mariozechner/pi-ai";
import type { EnvironmentDetailsOptions } from "./environment";
import { buildEnvironmentDetails, getDisplayCwd } from "./environment";

const taskProgressRecommendation = `
# task_progress RECOMMENDED

When starting a new task, it is recommended to include a todo list using the task_progress parameter.

1. Include a todo list using the task_progress parameter in your next tool call
2. Create a comprehensive checklist of all steps needed
3. Use markdown format: - [ ] for incomplete, - [x] for complete

**Benefits of creating a todo/task_progress list now:**
	- Clear roadmap for implementation
	- Progress tracking throughout the task
	- Nothing gets forgotten or missed
	- Users can see, monitor, and edit the plan
`;

function buildTaskResumptionPrefix(cwd: string) {
  return `[TASK RESUMPTION] This task was interrupted just now. It may or may not be complete, so please reassess the task context. Be aware that the project state may have changed since then. The current working directory is now '${getDisplayCwd(cwd)}'. If the task has not been completed, retry the last step before interruption and proceed with completing the task.

Note: If you previously attempted a tool use that the user did not provide a result for, you should assume the tool use was not successful and assess whether you should retry. If the last tool was a browser_action, the browser has been closed and you must launch a new browser if needed.

IMPORTANT: If the last tool use was a replace_in_file or write_to_file that was interrupted, the file was reverted back to its original state before the interrupted edit, and you do NOT need to re-read the file as you already have its up-to-date contents.`;
}

const normalizePromptText = (prompt: string) =>
  prompt.replace(/\s+/g, " ").trim();
const preservePromptText = (prompt: string) => prompt.trim();

function shouldIncludeWorkspaceSnapshot(
  options: EnvironmentDetailsOptions & { isInitialTurn: boolean },
) {
  return options.includeWorkspaceSnapshot || !options.isInitialTurn;
}

export function buildTaskUserMessage(
  prompt: string,
  options: EnvironmentDetailsOptions & { isInitialTurn: boolean },
): Message {
  const isResumingTask = !options.isInitialTurn;
  const content: Array<{ type: "text"; text: string }> = [
    {
      type: "text",
      text: isResumingTask
        ? buildTaskResumptionPrefix(options.cwd)
        : `<task>\n${normalizePromptText(prompt)}\n</task>`,
    },
  ];

  if (isResumingTask) {
    content.push({
      type: "text",
      text: `New instructions for task continuation:\n<user_message>\n${preservePromptText(prompt)}\n</user_message>`,
    });
  }

  content.push({ type: "text", text: taskProgressRecommendation });
  content.push({
    type: "text",
    text: buildEnvironmentDetails({
      ...options,
      includeWorkspaceSnapshot: shouldIncludeWorkspaceSnapshot(options),
    }),
  });

  return {
    role: "user",
    content,
    timestamp: Date.now(),
  };
}

export function buildToolResultEnvironmentDetails(
  options: EnvironmentDetailsOptions,
) {
  return buildEnvironmentDetails(options);
}
