import {
  applyAgentDefaultModelPrimary,
  type OpenCLIConfig,
} from "opencli/plugin-sdk/provider-onboard";

export const OPENCODE_GO_DEFAULT_MODEL_REF = "opencode-go/kimi-k2.6";

export function applyOpencodeGoProviderConfig(cfg: OpenCLIConfig): OpenCLIConfig {
  return cfg;
}

export function applyOpencodeGoConfig(cfg: OpenCLIConfig): OpenCLIConfig {
  return applyAgentDefaultModelPrimary(
    applyOpencodeGoProviderConfig(cfg),
    OPENCODE_GO_DEFAULT_MODEL_REF,
  );
}
