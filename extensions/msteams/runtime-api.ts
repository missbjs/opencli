// Private runtime barrel for the bundled Microsoft Teams extension.
// Keep this barrel thin and aligned with the local extension surface.

export { DEFAULT_ACCOUNT_ID } from "opencli/plugin-sdk/account-id";
export type { AllowlistMatch } from "opencli/plugin-sdk/allow-from";
export {
  mergeAllowlist,
  resolveAllowlistMatchSimple,
  summarizeMapping,
} from "opencli/plugin-sdk/allow-from";
export type {
  BaseProbeResult,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelOutboundAdapter,
} from "opencli/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "opencli/plugin-sdk/channel-core";
export { logTypingFailure } from "opencli/plugin-sdk/channel-logging";
export { createChannelPairingController } from "opencli/plugin-sdk/channel-pairing";
export {
  evaluateSenderGroupAccessForPolicy,
  readStoreAllowFromForDmPolicy,
  resolveDmGroupAccessWithLists,
  resolveEffectiveAllowFromLists,
  resolveSenderScopedGroupPolicy,
  resolveToolsBySender,
} from "opencli/plugin-sdk/channel-policy";
export { createChannelReplyPipeline } from "opencli/plugin-sdk/channel-reply-pipeline";
export {
  PAIRING_APPROVED_MESSAGE,
  buildProbeChannelStatusSummary,
  createDefaultChannelRuntimeState,
} from "opencli/plugin-sdk/channel-status";
export {
  buildChannelKeyCandidates,
  normalizeChannelSlug,
  resolveChannelEntryMatchWithFallback,
  resolveNestedAllowlistDecision,
} from "opencli/plugin-sdk/channel-targets";
export type {
  GroupPolicy,
  GroupToolPolicyConfig,
  MSTeamsChannelConfig,
  MSTeamsConfig,
  MSTeamsReplyStyle,
  MSTeamsTeamConfig,
  MarkdownTableMode,
  OpenCLIConfig,
} from "opencli/plugin-sdk/config-types";
export { isDangerousNameMatchingEnabled } from "opencli/plugin-sdk/dangerous-name-runtime";
export { resolveDefaultGroupPolicy } from "opencli/plugin-sdk/runtime-group-policy";
export { withFileLock } from "opencli/plugin-sdk/file-lock";
export { keepHttpServerTaskAlive } from "opencli/plugin-sdk/channel-lifecycle";
export {
  detectMime,
  extensionForMime,
  extractOriginalFilename,
  getFileExtension,
  resolveChannelMediaMaxBytes,
} from "opencli/plugin-sdk/media-runtime";
export { dispatchReplyFromConfigWithSettledDispatcher } from "opencli/plugin-sdk/inbound-reply-dispatch";
export { loadOutboundMediaFromUrl } from "opencli/plugin-sdk/outbound-media";
export { buildMediaPayload } from "opencli/plugin-sdk/reply-payload";
export type { ReplyPayload } from "opencli/plugin-sdk/reply-payload";
export type { PluginRuntime } from "opencli/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "opencli/plugin-sdk/runtime";
export type { SsrFPolicy } from "opencli/plugin-sdk/ssrf-runtime";
export { fetchWithSsrFGuard } from "opencli/plugin-sdk/ssrf-runtime";
export { normalizeStringEntries } from "opencli/plugin-sdk/string-normalization-runtime";
export { chunkTextForOutbound } from "opencli/plugin-sdk/text-chunking";
export { DEFAULT_WEBHOOK_MAX_BODY_BYTES } from "opencli/plugin-sdk/webhook-ingress";
export { setMSTeamsRuntime } from "./src/runtime.js";
