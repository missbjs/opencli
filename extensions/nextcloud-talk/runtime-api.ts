// Private runtime barrel for the bundled Nextcloud Talk extension.
// Keep this barrel thin and aligned with the local extension surface.

export type { AllowlistMatch } from "opencli/plugin-sdk/allow-from";
export type { ChannelGroupContext } from "opencli/plugin-sdk/channel-contract";
export { logInboundDrop } from "opencli/plugin-sdk/channel-logging";
export { createChannelPairingController } from "opencli/plugin-sdk/channel-pairing";
export {
  readStoreAllowFromForDmPolicy,
  resolveDmGroupAccessWithCommandGate,
} from "opencli/plugin-sdk/channel-policy";
export type {
  BlockStreamingCoalesceConfig,
  DmConfig,
  DmPolicy,
  GroupPolicy,
  GroupToolPolicyConfig,
  OpenCLIConfig,
} from "opencli/plugin-sdk/config-types";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "opencli/plugin-sdk/runtime-group-policy";
export { dispatchInboundReplyWithBase } from "opencli/plugin-sdk/inbound-reply-dispatch";
export type { OutboundReplyPayload } from "opencli/plugin-sdk/reply-payload";
export { deliverFormattedTextWithAttachments } from "opencli/plugin-sdk/reply-payload";
export type { PluginRuntime } from "opencli/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "opencli/plugin-sdk/runtime";
export type { SecretInput } from "opencli/plugin-sdk/secret-input";
export { fetchWithSsrFGuard } from "opencli/plugin-sdk/ssrf-runtime";
export { setNextcloudTalkRuntime } from "./src/runtime.js";
