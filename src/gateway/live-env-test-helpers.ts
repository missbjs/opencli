const COMMON_LIVE_ENV_NAMES = [
  "OPENCLI_AGENT_RUNTIME",
  "OPENCLI_CONFIG_PATH",
  "OPENCLI_GATEWAY_TOKEN",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "OPENCLI_SKIP_BROWSER_CONTROL_SERVER",
  "OPENCLI_SKIP_CANVAS_HOST",
  "OPENCLI_SKIP_CHANNELS",
  "OPENCLI_SKIP_CRON",
  "OPENCLI_SKIP_GMAIL_WATCHER",
  "OPENCLI_STATE_DIR",
] as const;

export type LiveEnvSnapshot = Record<string, string | undefined>;

export function snapshotLiveEnv(extraNames: readonly string[] = []): LiveEnvSnapshot {
  const snapshot: LiveEnvSnapshot = {};
  for (const name of [...COMMON_LIVE_ENV_NAMES, ...extraNames]) {
    snapshot[name] = process.env[name];
  }
  return snapshot;
}

export function restoreLiveEnv(snapshot: LiveEnvSnapshot): void {
  for (const [name, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
}
