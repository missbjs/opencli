import type { OpenCLIConfig } from "../config/types.js";
import {
  buildCapabilityProviderMaps,
  normalizeCapabilityProviderId,
} from "../plugins/provider-registry-shared.js";
import type { SpeechProviderPlugin } from "../plugins/types.js";
import type { SpeechProviderId } from "./provider-types.js";

export type SpeechProviderRegistryResolver = {
  getProvider: (providerId: string, cfg?: OpenCLIConfig) => SpeechProviderPlugin | undefined;
  listProviders: (cfg?: OpenCLIConfig) => SpeechProviderPlugin[];
};

export function normalizeSpeechProviderId(
  providerId: string | undefined,
): SpeechProviderId | undefined {
  return normalizeCapabilityProviderId(providerId);
}

export function createSpeechProviderRegistry(resolver: SpeechProviderRegistryResolver) {
  const buildResolvedProviderMaps = (cfg?: OpenCLIConfig) =>
    buildCapabilityProviderMaps(resolver.listProviders(cfg));

  const listProviders = (cfg?: OpenCLIConfig): SpeechProviderPlugin[] => [
    ...buildResolvedProviderMaps(cfg).canonical.values(),
  ];

  const getProvider = (
    providerId: string | undefined,
    cfg?: OpenCLIConfig,
  ): SpeechProviderPlugin | undefined => {
    const normalized = normalizeSpeechProviderId(providerId);
    if (!normalized) {
      return undefined;
    }
    return (
      resolver.getProvider(normalized, cfg) ??
      buildResolvedProviderMaps(cfg).aliases.get(normalized)
    );
  };

  const canonicalizeProviderId = (
    providerId: string | undefined,
    cfg?: OpenCLIConfig,
  ): SpeechProviderId | undefined => {
    const normalized = normalizeSpeechProviderId(providerId);
    if (!normalized) {
      return undefined;
    }
    return getProvider(normalized, cfg)?.id ?? normalized;
  };

  return {
    canonicalizeSpeechProviderId: canonicalizeProviderId,
    getSpeechProvider: getProvider,
    listSpeechProviders: listProviders,
  };
}
