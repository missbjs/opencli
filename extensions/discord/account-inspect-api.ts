import type { OpenCLIConfig } from "opencli/plugin-sdk/config-types";
import { inspectDiscordAccount } from "./src/account-inspect.js";

export function inspectDiscordReadOnlyAccount(cfg: OpenCLIConfig, accountId?: string | null) {
  return inspectDiscordAccount({ cfg, accountId });
}
