import type { OpenCLIConfig as RuntimeApiOpenCLIConfig } from "opencli/plugin-sdk/config-types";

export {
  DEFAULT_ACCOUNT_ID,
  getChatChannelMeta,
  type ChannelPlugin,
  type OpenCLIConfig,
} from "opencli/plugin-sdk/core";
export { buildChannelConfigSchema, IMessageConfigSchema } from "./config-api.js";
export { PAIRING_APPROVED_MESSAGE } from "opencli/plugin-sdk/channel-status";
export {
  buildComputedAccountStatusSnapshot,
  collectStatusIssuesFromLastError,
} from "opencli/plugin-sdk/status-helpers";
export { formatTrimmedAllowFromEntries } from "opencli/plugin-sdk/channel-config-helpers";
export {
  resolveIMessageConfigAllowFrom,
  resolveIMessageConfigDefaultTo,
} from "./src/config-accessors.js";
export { looksLikeIMessageTargetId, normalizeIMessageMessagingTarget } from "./src/normalize.js";
export { resolveChannelMediaMaxBytes } from "opencli/plugin-sdk/media-runtime";
export {
  resolveIMessageGroupRequireMention,
  resolveIMessageGroupToolPolicy,
} from "./src/group-policy.js";

export { monitorIMessageProvider } from "./src/monitor.js";
export type { MonitorIMessageOpts } from "./src/monitor.js";
export { probeIMessage } from "./src/probe.js";
export type { IMessageProbe } from "./src/probe.js";
export { sendMessageIMessage } from "./src/send.js";
export { setIMessageRuntime } from "./src/runtime.js";
export { chunkTextForOutbound } from "./src/channel-api.js";
export type IMessageAccountConfig = Omit<
  NonNullable<NonNullable<RuntimeApiOpenCLIConfig["channels"]>["imessage"]>,
  "accounts" | "defaultAccount"
>;
