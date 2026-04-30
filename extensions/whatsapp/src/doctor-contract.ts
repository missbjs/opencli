import type { ChannelDoctorConfigMutation } from "opencli/plugin-sdk/channel-contract";
import type { OpenCLIConfig } from "opencli/plugin-sdk/config-types";
import { normalizeCompatibilityConfig as normalizeCompatibilityConfigImpl } from "./doctor.js";

export function normalizeCompatibilityConfig({
  cfg,
}: {
  cfg: OpenCLIConfig;
}): ChannelDoctorConfigMutation {
  return normalizeCompatibilityConfigImpl({ cfg });
}
