// Private runtime barrel for the bundled Google Chat extension.
// Keep this barrel thin and avoid broad plugin-sdk surfaces during bootstrap.

export { DEFAULT_ACCOUNT_ID } from "opencli/plugin-sdk/account-id";
export {
  createActionGate,
  jsonResult,
  readNumberParam,
  readReactionParams,
  readStringParam,
} from "opencli/plugin-sdk/channel-actions";
export { buildChannelConfigSchema } from "opencli/plugin-sdk/channel-config-primitives";
export type {
  ChannelMessageActionAdapter,
  ChannelMessageActionName,
  ChannelStatusIssue,
} from "opencli/plugin-sdk/channel-contract";
export { missingTargetError } from "opencli/plugin-sdk/channel-feedback";
export {
  createAccountStatusSink,
  runPassiveAccountLifecycle,
} from "opencli/plugin-sdk/channel-lifecycle";
export { createChannelPairingController } from "opencli/plugin-sdk/channel-pairing";
export { createChannelReplyPipeline } from "opencli/plugin-sdk/channel-reply-pipeline";
export {
  evaluateGroupRouteAccessForPolicy,
  resolveDmGroupAccessWithLists,
  resolveSenderScopedGroupPolicy,
} from "opencli/plugin-sdk/channel-policy";
export { PAIRING_APPROVED_MESSAGE } from "opencli/plugin-sdk/channel-status";
export { chunkTextForOutbound } from "opencli/plugin-sdk/text-chunking";
export type { OpenCLIConfig } from "opencli/plugin-sdk/config-types";
export { GoogleChatConfigSchema } from "opencli/plugin-sdk/bundled-channel-config-schema";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "opencli/plugin-sdk/runtime-group-policy";
export { isDangerousNameMatchingEnabled } from "opencli/plugin-sdk/dangerous-name-runtime";
export { fetchRemoteMedia, resolveChannelMediaMaxBytes } from "opencli/plugin-sdk/media-runtime";
export { loadOutboundMediaFromUrl } from "opencli/plugin-sdk/outbound-media";
export type { PluginRuntime } from "opencli/plugin-sdk/runtime-store";
export { fetchWithSsrFGuard } from "opencli/plugin-sdk/ssrf-runtime";
export type { GoogleChatAccountConfig, GoogleChatConfig } from "opencli/plugin-sdk/config-types";
export { extractToolSend } from "opencli/plugin-sdk/tool-send";
export { resolveInboundMentionDecision } from "opencli/plugin-sdk/channel-inbound";
export { resolveInboundRouteEnvelopeBuilderWithRuntime } from "opencli/plugin-sdk/inbound-envelope";
export { resolveWebhookPath } from "opencli/plugin-sdk/webhook-path";
export {
  registerWebhookTargetWithPluginRoute,
  resolveWebhookTargetWithAuthOrReject,
  withResolvedWebhookRequestPipeline,
} from "opencli/plugin-sdk/webhook-targets";
export {
  createWebhookInFlightLimiter,
  readJsonWebhookBodyOrReject,
  type WebhookInFlightLimiter,
} from "opencli/plugin-sdk/webhook-request-guards";
export { setGoogleChatRuntime } from "./src/runtime.js";
