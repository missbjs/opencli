import type { OpenCLIConfig } from "opencli/plugin-sdk/config-types";
import type { CommandArgValues } from "opencli/plugin-sdk/native-command-registry";

export type DiscordConfig = NonNullable<OpenCLIConfig["channels"]>["discord"];

export type DiscordCommandArgs = {
  raw?: string;
  values?: CommandArgValues;
};
