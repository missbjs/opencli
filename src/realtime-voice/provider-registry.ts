import type { OpenCLIConfig } from "../config/types.opencli.js";
import { resolvePluginCapabilityProviders } from "../plugins/capability-provider-runtime.js";
import {
  buildCapabilityProviderMaps,
  normalizeCapabilityProviderId,
} from "../plugins/provider-registry-shared.js";
import type { RealtimeVoiceProviderPlugin } from "../plugins/types.js";
import type { RealtimeVoiceProviderId } from "./provider-types.js";

export function normalizeRealtimeVoiceProviderId(
  providerId: string | undefined,
): RealtimeVoiceProviderId | undefined {
  return normalizeCapabilityProviderId(providerId);
}

function resolveRealtimeVoiceProviderEntries(cfg?: OpenCLIConfig): RealtimeVoiceProviderPlugin[] {
  return resolvePluginCapabilityProviders({
    key: "realtimeVoiceProviders",
    cfg,
  });
}

function buildProviderMaps(cfg?: OpenCLIConfig): {
  canonical: Map<string, RealtimeVoiceProviderPlugin>;
  aliases: Map<string, RealtimeVoiceProviderPlugin>;
} {
  return buildCapabilityProviderMaps(resolveRealtimeVoiceProviderEntries(cfg));
}

export function listRealtimeVoiceProviders(cfg?: OpenCLIConfig): RealtimeVoiceProviderPlugin[] {
  return [...buildProviderMaps(cfg).canonical.values()];
}

export function getRealtimeVoiceProvider(
  providerId: string | undefined,
  cfg?: OpenCLIConfig,
): RealtimeVoiceProviderPlugin | undefined {
  const normalized = normalizeRealtimeVoiceProviderId(providerId);
  if (!normalized) {
    return undefined;
  }
  return buildProviderMaps(cfg).aliases.get(normalized);
}

export function canonicalizeRealtimeVoiceProviderId(
  providerId: string | undefined,
  cfg?: OpenCLIConfig,
): RealtimeVoiceProviderId | undefined {
  const normalized = normalizeRealtimeVoiceProviderId(providerId);
  if (!normalized) {
    return undefined;
  }
  return getRealtimeVoiceProvider(normalized, cfg)?.id ?? normalized;
}
