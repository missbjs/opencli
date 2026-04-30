import { buildManifestModelProviderConfig } from "opencli/plugin-sdk/provider-catalog-shared";
import type { ModelProviderConfig } from "opencli/plugin-sdk/provider-model-shared";
import manifest from "./opencli.plugin.json" with { type: "json" };

export function buildMistralProvider(): ModelProviderConfig {
  return buildManifestModelProviderConfig({
    providerId: "mistral",
    catalog: manifest.modelCatalog.providers.mistral,
  });
}
