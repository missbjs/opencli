// Private runtime barrel for the bundled IRC extension.
// Keep this barrel thin and generic-only.

export type { BaseProbeResult } from "opencli/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "opencli/plugin-sdk/channel-core";
export type { OpenCLIConfig } from "opencli/plugin-sdk/config-types";
export type { PluginRuntime } from "opencli/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "opencli/plugin-sdk/runtime";
export type {
  BlockStreamingCoalesceConfig,
  DmConfig,
  DmPolicy,
  GroupPolicy,
  GroupToolPolicyBySenderConfig,
  GroupToolPolicyConfig,
  MarkdownConfig,
} from "opencli/plugin-sdk/config-types";
export type { OutboundReplyPayload } from "opencli/plugin-sdk/reply-payload";
export { DEFAULT_ACCOUNT_ID } from "opencli/plugin-sdk/account-id";
export { buildChannelConfigSchema } from "opencli/plugin-sdk/channel-config-primitives";
export {
  PAIRING_APPROVED_MESSAGE,
  buildBaseChannelStatusSummary,
} from "opencli/plugin-sdk/channel-status";
export { createChannelPairingController } from "opencli/plugin-sdk/channel-pairing";
export { createAccountStatusSink } from "opencli/plugin-sdk/channel-lifecycle";
export {
  readStoreAllowFromForDmPolicy,
  resolveEffectiveAllowFromLists,
} from "opencli/plugin-sdk/channel-policy";
export { resolveControlCommandGate } from "opencli/plugin-sdk/command-auth";
export { dispatchInboundReplyWithBase } from "opencli/plugin-sdk/inbound-reply-dispatch";
export { chunkTextForOutbound } from "opencli/plugin-sdk/text-chunking";
export {
  deliverFormattedTextWithAttachments,
  formatTextWithAttachmentLinks,
  resolveOutboundMediaUrls,
} from "opencli/plugin-sdk/reply-payload";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "opencli/plugin-sdk/runtime-group-policy";
export { isDangerousNameMatchingEnabled } from "opencli/plugin-sdk/dangerous-name-runtime";
export { logInboundDrop } from "opencli/plugin-sdk/channel-inbound";
