import type { OpenCLIConfig } from "../config/types.opencli.js";

export function isGatewayModelPricingEnabled(config: OpenCLIConfig): boolean {
  return config.models?.pricing?.enabled !== false;
}
