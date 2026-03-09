import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) => {
  pi.registerProvider("cline", {});
};
