import type { OpenCLIConfig } from "opencli/plugin-sdk/config-types";
import { inspectSlackAccount } from "./src/account-inspect.js";

export function inspectSlackReadOnlyAccount(cfg: OpenCLIConfig, accountId?: string | null) {
  return inspectSlackAccount({ cfg, accountId });
}
