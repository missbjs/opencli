import type { OpenCLIConfig } from "opencli/plugin-sdk/config-types";

export type SignalAccountConfig = Omit<
  Exclude<NonNullable<OpenCLIConfig["channels"]>["signal"], undefined>,
  "accounts"
>;
