import { BaseSemanticTool } from "./base";

export class DisplayOnlyTool extends BaseSemanticTool {
  private readonly parameterName: string;

  constructor(id: string, parameterName: string) {
    super(id, "display_only");
    this.parameterName = parameterName;
  }

  override getDisplayText(
    parameters: Record<string, string>,
  ): string | undefined {
    return parameters[this.parameterName];
  }
}
