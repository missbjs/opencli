// Narrow Matrix monitor helper seam.
// Keep monitor internals off the broad package runtime-api barrel so monitor
// tests and shared workers do not pull unrelated Matrix helper surfaces.

export type { NormalizedLocation } from "opencli/plugin-sdk/channel-location";
export type { PluginRuntime, RuntimeLogger } from "opencli/plugin-sdk/plugin-runtime";
export type { BlockReplyContext, ReplyPayload } from "opencli/plugin-sdk/reply-runtime";
export type { MarkdownTableMode, OpenCLIConfig } from "opencli/plugin-sdk/config-types";
export type { RuntimeEnv } from "opencli/plugin-sdk/runtime";
export {
  addAllowlistUserEntriesFromConfigEntry,
  buildAllowlistResolutionSummary,
  canonicalizeAllowlistWithResolvedIds,
  formatAllowlistMatchMeta,
  patchAllowlistUsersInConfigEntries,
  summarizeMapping,
} from "opencli/plugin-sdk/allow-from";
export {
  createReplyPrefixOptions,
  createTypingCallbacks,
} from "opencli/plugin-sdk/channel-reply-options-runtime";
export { formatLocationText, toLocationContext } from "opencli/plugin-sdk/channel-location";
export { getAgentScopedMediaLocalRoots } from "opencli/plugin-sdk/agent-media-payload";
export { logInboundDrop, logTypingFailure } from "opencli/plugin-sdk/channel-logging";
export { resolveAckReaction } from "opencli/plugin-sdk/channel-feedback";
export {
  buildChannelKeyCandidates,
  resolveChannelEntryMatch,
} from "opencli/plugin-sdk/channel-targets";
