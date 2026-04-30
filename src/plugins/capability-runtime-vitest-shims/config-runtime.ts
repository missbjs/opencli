import { resolveActiveTalkProviderConfig } from "../../config/talk.js";
import type { OpenCLIConfig } from "../../config/types.js";

export { resolveActiveTalkProviderConfig };

export function getRuntimeConfigSnapshot(): OpenCLIConfig | null {
  return null;
}
