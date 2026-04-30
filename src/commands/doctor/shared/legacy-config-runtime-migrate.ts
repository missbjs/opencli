import type { OpenCLIConfig } from "../../../config/types.opencli.js";
import { normalizeBaseCompatibilityConfigValues } from "./legacy-config-compatibility-base.js";

export function normalizeRuntimeCompatibilityConfigValues(cfg: OpenCLIConfig): {
  config: OpenCLIConfig;
  changes: string[];
} {
  const changes: string[] = [];
  const next = normalizeBaseCompatibilityConfigValues(cfg, changes);
  return { config: next, changes };
}
