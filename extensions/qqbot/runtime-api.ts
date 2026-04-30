export type { ChannelPlugin, OpenCLIPluginApi, PluginRuntime } from "opencli/plugin-sdk/core";
export type { OpenCLIConfig } from "opencli/plugin-sdk/config-types";
export type {
  OpenCLIPluginService,
  OpenCLIPluginServiceContext,
  PluginLogger,
} from "opencli/plugin-sdk/core";
export type { ResolvedQQBotAccount, QQBotAccountConfig } from "./src/types.js";
export { getQQBotRuntime, setQQBotRuntime } from "./src/bridge/runtime.js";
