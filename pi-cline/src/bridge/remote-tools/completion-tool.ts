import { BaseSemanticTool } from "./base";

export class CompletionTool extends BaseSemanticTool {
  constructor(id: string) {
    super(id, "completion");
  }

  override isAdvertised() {
    return true;
  }

  override getCompletionText(
    parameters: Record<string, string>,
    rawText: string,
  ) {
    return typeof parameters.result === "string" ? parameters.result : rawText;
  }
}
