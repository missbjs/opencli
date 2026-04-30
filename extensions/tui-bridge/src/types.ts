export type TuiMode = "txt" | "tui";

export type TuiBindingData = {
  command: string;
  args: string[];
  cwd: string;
  mode: TuiMode;
  startedAt: number;
};

export type TuiPluginConfig = {
  defaultMode?: TuiMode;
  settleIdleMs?: number;
  settleMaxMs?: number;
  cols?: number;
  rows?: number;
  logDir?: string;
  allowedCommands?: string[];
};

export const DEFAULT_CONFIG: Required<Omit<TuiPluginConfig, "logDir" | "allowedCommands">> & {
  logDir?: string;
  allowedCommands?: string[];
} = {
  defaultMode: "txt",
  settleIdleMs: 600,
  settleMaxMs: 30_000,
  cols: 100,
  rows: 30,
};

export function resolveConfig(raw: unknown): typeof DEFAULT_CONFIG {
  const cfg = (raw && typeof raw === "object" ? raw : {}) as TuiPluginConfig;
  return {
    defaultMode: cfg.defaultMode ?? DEFAULT_CONFIG.defaultMode,
    settleIdleMs: cfg.settleIdleMs ?? DEFAULT_CONFIG.settleIdleMs,
    settleMaxMs: cfg.settleMaxMs ?? DEFAULT_CONFIG.settleMaxMs,
    cols: cfg.cols ?? DEFAULT_CONFIG.cols,
    rows: cfg.rows ?? DEFAULT_CONFIG.rows,
    logDir: cfg.logDir,
    allowedCommands: cfg.allowedCommands,
  };
}
