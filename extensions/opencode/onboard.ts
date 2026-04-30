import {
  applyAgentDefaultModelPrimary,
  withAgentModelAliases,
  type OpenCLIConfig,
} from "opencli/plugin-sdk/provider-onboard";

export const OPENCODE_ZEN_DEFAULT_MODEL_REF = "opencode/claude-opus-4-6";

export function applyOpencodeZenProviderConfig(cfg: OpenCLIConfig): OpenCLIConfig {
  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...cfg.agents?.defaults,
        models: withAgentModelAliases(cfg.agents?.defaults?.models, [
          { modelRef: OPENCODE_ZEN_DEFAULT_MODEL_REF, alias: "Opus" },
        ]),
      },
    },
  };
}

export function applyOpencodeZenConfig(cfg: OpenCLIConfig): OpenCLIConfig {
  return applyAgentDefaultModelPrimary(
    applyOpencodeZenProviderConfig(cfg),
    OPENCODE_ZEN_DEFAULT_MODEL_REF,
  );
}
