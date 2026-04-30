import type { OpenCLIConfig } from "../../config/types.opencli.js";
import type { HookClientIpConfig } from "./hooks-request-handler.js";

export function resolveHookClientIpConfig(cfg: OpenCLIConfig): HookClientIpConfig {
  return {
    trustedProxies: cfg.gateway?.trustedProxies,
    allowRealIpFallback: cfg.gateway?.allowRealIpFallback === true,
  };
}
