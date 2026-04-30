import type { OpenCLIConfig } from "opencli/plugin-sdk/config-types";

export type WhatsAppAccountConfig = NonNullable<
  NonNullable<NonNullable<OpenCLIConfig["channels"]>["whatsapp"]>["accounts"]
>[string];
