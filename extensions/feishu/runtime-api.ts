// Private runtime barrel for the bundled Feishu extension.
// Keep this barrel thin and generic-only.

export type {
  AllowlistMatch,
  AnyAgentTool,
  BaseProbeResult,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelMeta,
  ChannelOutboundAdapter,
  ChannelPlugin,
  HistoryEntry,
  OpenCLIConfig,
  OpenCLIPluginApi,
  OutboundIdentity,
  PluginRuntime,
  ReplyPayload,
} from "opencli/plugin-sdk/core";
export type { OpenCLIConfig as ClawdbotConfig } from "opencli/plugin-sdk/core";
export type { RuntimeEnv } from "opencli/plugin-sdk/runtime";
export type { GroupToolPolicyConfig } from "opencli/plugin-sdk/config-types";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  createActionGate,
  createDedupeCache,
} from "opencli/plugin-sdk/core";
export {
  PAIRING_APPROVED_MESSAGE,
  buildProbeChannelStatusSummary,
  createDefaultChannelRuntimeState,
} from "opencli/plugin-sdk/channel-status";
export { buildAgentMediaPayload } from "opencli/plugin-sdk/agent-media-payload";
export { createChannelPairingController } from "opencli/plugin-sdk/channel-pairing";
export { createReplyPrefixContext } from "opencli/plugin-sdk/channel-reply-pipeline";
export {
  evaluateSupplementalContextVisibility,
  filterSupplementalContextItems,
  resolveChannelContextVisibilityMode,
} from "opencli/plugin-sdk/context-visibility-runtime";
export {
  loadSessionStore,
  resolveSessionStoreEntry,
} from "opencli/plugin-sdk/session-store-runtime";
export { readJsonFileWithFallback } from "opencli/plugin-sdk/json-store";
export { createPersistentDedupe } from "opencli/plugin-sdk/persistent-dedupe";
export { normalizeAgentId } from "opencli/plugin-sdk/routing";
export { chunkTextForOutbound } from "opencli/plugin-sdk/text-chunking";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
  requestBodyErrorToText,
} from "opencli/plugin-sdk/webhook-ingress";
export { setFeishuRuntime } from "./src/runtime.js";
