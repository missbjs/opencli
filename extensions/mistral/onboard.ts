import {
  createDefaultModelPresetAppliers,
  type OpenCLIConfig,
} from "opencli/plugin-sdk/provider-onboard";
import {
  buildMistralModelDefinition,
  MISTRAL_BASE_URL,
  MISTRAL_DEFAULT_MODEL_ID,
} from "./model-definitions.js";

export const MISTRAL_DEFAULT_MODEL_REF = `mistral/${MISTRAL_DEFAULT_MODEL_ID}`;

const mistralPresetAppliers = createDefaultModelPresetAppliers({
  primaryModelRef: MISTRAL_DEFAULT_MODEL_REF,
  resolveParams: (_cfg: OpenCLIConfig) => ({
    providerId: "mistral",
    api: "openai-completions",
    baseUrl: MISTRAL_BASE_URL,
    defaultModel: buildMistralModelDefinition(),
    defaultModelId: MISTRAL_DEFAULT_MODEL_ID,
    aliases: [{ modelRef: MISTRAL_DEFAULT_MODEL_REF, alias: "Mistral" }],
  }),
});

export function applyMistralProviderConfig(cfg: OpenCLIConfig): OpenCLIConfig {
  return mistralPresetAppliers.applyProviderConfig(cfg);
}

export function applyMistralConfig(cfg: OpenCLIConfig): OpenCLIConfig {
  return mistralPresetAppliers.applyConfig(cfg);
}
