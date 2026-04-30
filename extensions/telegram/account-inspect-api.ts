import type { OpenCLIConfig } from "./runtime-api.js";
import { inspectTelegramAccount } from "./src/account-inspect.js";

export function inspectTelegramReadOnlyAccount(cfg: OpenCLIConfig, accountId?: string | null) {
  return inspectTelegramAccount({ cfg, accountId });
}
