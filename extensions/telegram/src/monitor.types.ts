import type {
  ChannelAccountSnapshot,
  ChannelRuntimeSurface,
} from "opencli/plugin-sdk/channel-contract";
import type { OpenCLIConfig } from "opencli/plugin-sdk/config-types";
import type { RuntimeEnv } from "opencli/plugin-sdk/runtime-env";

export type MonitorTelegramOpts = {
  token?: string;
  accountId?: string;
  config?: OpenCLIConfig;
  runtime?: RuntimeEnv;
  channelRuntime?: ChannelRuntimeSurface;
  abortSignal?: AbortSignal;
  useWebhook?: boolean;
  webhookPath?: string;
  webhookPort?: number;
  webhookSecret?: string;
  webhookHost?: string;
  proxyFetch?: typeof fetch;
  webhookUrl?: string;
  webhookCertPath?: string;
  setStatus?: (patch: Omit<ChannelAccountSnapshot, "accountId">) => void;
};

export type TelegramMonitorFn = (opts?: MonitorTelegramOpts) => Promise<void>;
