import { readStringOrNumberParam, readStringParam } from "opencli/plugin-sdk/channel-actions";
import type { OpenCLIConfig } from "opencli/plugin-sdk/config-types";

export { resolveReactionMessageId } from "opencli/plugin-sdk/channel-actions";
export { handleWhatsAppAction } from "./action-runtime.js";
export { isWhatsAppGroupJid, normalizeWhatsAppTarget } from "./normalize.js";
export { readStringOrNumberParam, readStringParam, type OpenCLIConfig };
