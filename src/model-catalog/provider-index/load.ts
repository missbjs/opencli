import { normalizeOpenCLIProviderIndex } from "./normalize.js";
import { OPENCLI_PROVIDER_INDEX } from "./opencli-provider-index.js";
import type { OpenCLIProviderIndex } from "./types.js";

export function loadOpenCLIProviderIndex(
  source: unknown = OPENCLI_PROVIDER_INDEX,
): OpenCLIProviderIndex {
  return normalizeOpenCLIProviderIndex(source) ?? { version: 1, providers: {} };
}
