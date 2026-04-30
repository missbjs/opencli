import { getRuntimeConfig, type OpenCLIConfig } from "../config/config.js";

export function loadBrowserConfigForRuntimeRefresh(): OpenCLIConfig {
  return getRuntimeConfig();
}
