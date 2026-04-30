import { randomUUID } from "node:crypto";
import type { Agent } from "node:http";
import process from "node:process";
import { HttpsProxyAgent } from "https-proxy-agent";
import {
  resolveDebugProxyBlobDir,
  resolveDebugProxyCertDir,
  resolveDebugProxyDbPath,
} from "./paths.js";

export const OPENCLI_DEBUG_PROXY_ENABLED = "OPENCLI_DEBUG_PROXY_ENABLED";
export const OPENCLI_DEBUG_PROXY_URL = "OPENCLI_DEBUG_PROXY_URL";
export const OPENCLI_DEBUG_PROXY_DB_PATH = "OPENCLI_DEBUG_PROXY_DB_PATH";
export const OPENCLI_DEBUG_PROXY_BLOB_DIR = "OPENCLI_DEBUG_PROXY_BLOB_DIR";
export const OPENCLI_DEBUG_PROXY_CERT_DIR = "OPENCLI_DEBUG_PROXY_CERT_DIR";
export const OPENCLI_DEBUG_PROXY_SESSION_ID = "OPENCLI_DEBUG_PROXY_SESSION_ID";
export const OPENCLI_DEBUG_PROXY_REQUIRE = "OPENCLI_DEBUG_PROXY_REQUIRE";

export type DebugProxySettings = {
  enabled: boolean;
  required: boolean;
  proxyUrl?: string;
  dbPath: string;
  blobDir: string;
  certDir: string;
  sessionId: string;
  sourceProcess: string;
};

let cachedImplicitSessionId: string | undefined;

function isTruthy(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export function resolveDebugProxySettings(
  env: NodeJS.ProcessEnv = process.env,
): DebugProxySettings {
  const enabled = isTruthy(env[OPENCLI_DEBUG_PROXY_ENABLED]);
  const explicitSessionId = env[OPENCLI_DEBUG_PROXY_SESSION_ID]?.trim() || undefined;
  const sessionId = explicitSessionId ?? (cachedImplicitSessionId ??= randomUUID());
  return {
    enabled,
    required: isTruthy(env[OPENCLI_DEBUG_PROXY_REQUIRE]),
    proxyUrl: env[OPENCLI_DEBUG_PROXY_URL]?.trim() || undefined,
    dbPath: env[OPENCLI_DEBUG_PROXY_DB_PATH]?.trim() || resolveDebugProxyDbPath(env),
    blobDir: env[OPENCLI_DEBUG_PROXY_BLOB_DIR]?.trim() || resolveDebugProxyBlobDir(env),
    certDir: env[OPENCLI_DEBUG_PROXY_CERT_DIR]?.trim() || resolveDebugProxyCertDir(env),
    sessionId,
    sourceProcess: "opencli",
  };
}

export function applyDebugProxyEnv(
  env: NodeJS.ProcessEnv,
  params: {
    proxyUrl: string;
    sessionId: string;
    dbPath?: string;
    blobDir?: string;
    certDir?: string;
  },
): NodeJS.ProcessEnv {
  return {
    ...env,
    [OPENCLI_DEBUG_PROXY_ENABLED]: "1",
    [OPENCLI_DEBUG_PROXY_REQUIRE]: "1",
    [OPENCLI_DEBUG_PROXY_URL]: params.proxyUrl,
    [OPENCLI_DEBUG_PROXY_DB_PATH]: params.dbPath ?? resolveDebugProxyDbPath(env),
    [OPENCLI_DEBUG_PROXY_BLOB_DIR]: params.blobDir ?? resolveDebugProxyBlobDir(env),
    [OPENCLI_DEBUG_PROXY_CERT_DIR]: params.certDir ?? resolveDebugProxyCertDir(env),
    [OPENCLI_DEBUG_PROXY_SESSION_ID]: params.sessionId,
    HTTP_PROXY: params.proxyUrl,
    HTTPS_PROXY: params.proxyUrl,
    ALL_PROXY: params.proxyUrl,
  };
}

export function createDebugProxyWebSocketAgent(settings: DebugProxySettings): Agent | undefined {
  if (!settings.enabled || !settings.proxyUrl) {
    return undefined;
  }
  return new HttpsProxyAgent(settings.proxyUrl);
}

export function resolveEffectiveDebugProxyUrl(configuredProxyUrl?: string): string | undefined {
  const explicit = configuredProxyUrl?.trim();
  if (explicit) {
    return explicit;
  }
  const settings = resolveDebugProxySettings();
  return settings.enabled ? settings.proxyUrl : undefined;
}
