// Private runtime barrel for the bundled Twitch extension.
// Keep this barrel thin and aligned with the local extension surface.

export type {
  ChannelAccountSnapshot,
  ChannelCapabilities,
  ChannelGatewayContext,
  ChannelLogSink,
  ChannelMessageActionAdapter,
  ChannelMessageActionContext,
  ChannelMeta,
  ChannelOutboundAdapter,
  ChannelOutboundContext,
  ChannelResolveKind,
  ChannelResolveResult,
  ChannelStatusAdapter,
} from "opencli/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "opencli/plugin-sdk/channel-core";
export type { OutboundDeliveryResult } from "opencli/plugin-sdk/channel-send-result";
export type { OpenCLIConfig } from "opencli/plugin-sdk/config-types";
export type { RuntimeEnv } from "opencli/plugin-sdk/runtime";
export type { WizardPrompter } from "opencli/plugin-sdk/setup";
