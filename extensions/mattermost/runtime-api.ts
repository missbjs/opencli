// Private runtime barrel for the bundled Mattermost extension.
// Keep this barrel thin and generic-only.

export type {
  BaseProbeResult,
  ChannelAccountSnapshot,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelPlugin,
  ChatType,
  HistoryEntry,
  OpenCLIConfig,
  OpenCLIPluginApi,
  PluginRuntime,
} from "opencli/plugin-sdk/core";
export type { RuntimeEnv } from "opencli/plugin-sdk/runtime";
export type { ReplyPayload } from "opencli/plugin-sdk/reply-runtime";
export type { ModelsProviderData } from "opencli/plugin-sdk/command-auth";
export type {
  BlockStreamingCoalesceConfig,
  DmPolicy,
  GroupPolicy,
} from "opencli/plugin-sdk/config-types";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  createDedupeCache,
  parseStrictPositiveInteger,
  resolveClientIp,
  isTrustedProxyAddress,
} from "opencli/plugin-sdk/core";
export { buildComputedAccountStatusSnapshot } from "opencli/plugin-sdk/channel-status";
export { createAccountStatusSink } from "opencli/plugin-sdk/channel-lifecycle";
export { buildAgentMediaPayload } from "opencli/plugin-sdk/agent-media-payload";
export {
  buildModelsProviderData,
  listSkillCommandsForAgents,
  resolveControlCommandGate,
  resolveStoredModelOverride,
} from "opencli/plugin-sdk/command-auth";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "opencli/plugin-sdk/runtime-group-policy";
export { isDangerousNameMatchingEnabled } from "opencli/plugin-sdk/dangerous-name-runtime";
export { loadSessionStore, resolveStorePath } from "opencli/plugin-sdk/session-store-runtime";
export { formatInboundFromLabel } from "opencli/plugin-sdk/channel-inbound";
export { logInboundDrop } from "opencli/plugin-sdk/channel-inbound";
export { createChannelPairingController } from "opencli/plugin-sdk/channel-pairing";
export {
  DM_GROUP_ACCESS_REASON,
  readStoreAllowFromForDmPolicy,
  resolveDmGroupAccessWithLists,
  resolveEffectiveAllowFromLists,
} from "opencli/plugin-sdk/channel-policy";
export { evaluateSenderGroupAccessForPolicy } from "opencli/plugin-sdk/group-access";
export { createChannelReplyPipeline } from "opencli/plugin-sdk/channel-reply-pipeline";
export { logTypingFailure } from "opencli/plugin-sdk/channel-feedback";
export { loadOutboundMediaFromUrl } from "opencli/plugin-sdk/outbound-media";
export { rawDataToString } from "opencli/plugin-sdk/webhook-ingress";
export { chunkTextForOutbound } from "opencli/plugin-sdk/text-chunking";
export {
  DEFAULT_GROUP_HISTORY_LIMIT,
  buildPendingHistoryContextFromMap,
  clearHistoryEntriesIfEnabled,
  recordPendingHistoryEntryIfEnabled,
} from "opencli/plugin-sdk/reply-history";
export { normalizeAccountId, resolveThreadSessionKeys } from "opencli/plugin-sdk/routing";
export { resolveAllowlistMatchSimple } from "opencli/plugin-sdk/allow-from";
export { registerPluginHttpRoute } from "opencli/plugin-sdk/webhook-targets";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
} from "opencli/plugin-sdk/webhook-ingress";
export {
  applyAccountNameToChannelSection,
  applySetupAccountConfigPatch,
  migrateBaseNameToDefaultAccount,
} from "opencli/plugin-sdk/setup";
export {
  getAgentScopedMediaLocalRoots,
  resolveChannelMediaMaxBytes,
} from "opencli/plugin-sdk/media-runtime";
export { normalizeProviderId } from "opencli/plugin-sdk/provider-model-shared";
export { setMattermostRuntime } from "./src/runtime.js";
