import {
  getRuntimeConfigSnapshot,
  getRuntimeConfigSourceSnapshot,
} from "../config/runtime-snapshot.js";
import type { OpenCLIConfig } from "../config/types.opencli.js";

export function resolvePluginActivationSourceConfig(params: {
  config?: OpenCLIConfig;
  activationSourceConfig?: OpenCLIConfig;
}): OpenCLIConfig {
  if (params.activationSourceConfig !== undefined) {
    return params.activationSourceConfig;
  }
  const sourceSnapshot = getRuntimeConfigSourceSnapshot();
  if (sourceSnapshot && params.config === getRuntimeConfigSnapshot()) {
    return sourceSnapshot;
  }
  return params.config ?? {};
}
