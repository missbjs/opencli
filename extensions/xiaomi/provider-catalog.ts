import { buildManifestModelProviderConfig } from "opencli/plugin-sdk/provider-catalog-shared";
import type { ModelProviderConfig } from "opencli/plugin-sdk/provider-model-shared";
import manifest from "./opencli.plugin.json" with { type: "json" };

export const XIAOMI_DEFAULT_MODEL_ID = "mimo-v2-flash";

export function buildXiaomiProvider(): ModelProviderConfig {
  return buildManifestModelProviderConfig({
    providerId: "xiaomi",
    catalog: manifest.modelCatalog.providers.xiaomi,
  });
}
