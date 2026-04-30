import type { OpenCLIConfig } from "opencli/plugin-sdk/config-types";

export type IMessageAccountConfig = Omit<
  NonNullable<NonNullable<OpenCLIConfig["channels"]>["imessage"]>,
  "accounts" | "defaultAccount"
>;
