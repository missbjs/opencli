import {
  applyAgentDefaultModelPrimary,
  type OpenCLIConfig,
} from "opencli/plugin-sdk/provider-onboard";
import { DEEPINFRA_BASE_URL, DEEPINFRA_DEFAULT_MODEL_REF } from "./provider-models.js";

export { DEEPINFRA_BASE_URL, DEEPINFRA_DEFAULT_MODEL_REF };

export function applyDeepInfraProviderConfig(
  cfg: OpenCLIConfig,
  modelRef: string = DEEPINFRA_DEFAULT_MODEL_REF,
): OpenCLIConfig {
  const models = { ...cfg.agents?.defaults?.models };
  models[modelRef] = {
    ...models[modelRef],
    alias: models[modelRef]?.alias ?? "DeepInfra",
  };

  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...cfg.agents?.defaults,
        models,
      },
    },
  };
}

export function applyDeepInfraConfig(
  cfg: OpenCLIConfig,
  modelRef: string = DEEPINFRA_DEFAULT_MODEL_REF,
): OpenCLIConfig {
  return applyAgentDefaultModelPrimary(applyDeepInfraProviderConfig(cfg, modelRef), modelRef);
}
