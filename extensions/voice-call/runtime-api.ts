// Private runtime barrel for the bundled Voice Call extension.
// Keep this barrel thin and aligned with the local extension surface.

export { definePluginEntry } from "opencli/plugin-sdk/plugin-entry";
export type { OpenCLIPluginApi } from "opencli/plugin-sdk/plugin-entry";
export type { GatewayRequestHandlerOptions } from "opencli/plugin-sdk/gateway-runtime";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
  requestBodyErrorToText,
} from "opencli/plugin-sdk/webhook-request-guards";
export { fetchWithSsrFGuard, isBlockedHostnameOrIp } from "opencli/plugin-sdk/ssrf-runtime";
export type { SessionEntry } from "opencli/plugin-sdk/session-store-runtime";
export {
  TtsAutoSchema,
  TtsConfigSchema,
  TtsModeSchema,
  TtsProviderSchema,
} from "opencli/plugin-sdk/tts-runtime";
export { sleep } from "opencli/plugin-sdk/runtime-env";
