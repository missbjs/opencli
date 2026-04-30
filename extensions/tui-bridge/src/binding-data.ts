import type { PluginConversationBinding } from "openclaw/plugin-sdk/plugin-entry";
import type { TuiBindingData, TuiMode } from "./types.js";

export const BINDING_KIND = "tui-bridge-process";
export const BINDING_VERSION = 1;

export type StoredBindingData = {
  kind: typeof BINDING_KIND;
  version: typeof BINDING_VERSION;
  command: string;
  args: string[];
  cwd: string;
  mode: TuiMode;
  startedAt: number;
};

export function createBindingData(input: {
  command: string;
  args: string[];
  cwd: string;
  mode: TuiMode;
}): StoredBindingData {
  return {
    kind: BINDING_KIND,
    version: BINDING_VERSION,
    command: input.command,
    args: [...input.args],
    cwd: input.cwd,
    mode: input.mode,
    startedAt: Date.now(),
  };
}

export function readBindingData(
  binding: PluginConversationBinding | null | undefined,
): TuiBindingData | undefined {
  const data = binding?.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  return readBindingDataRecord(data as Record<string, unknown>);
}

export function readBindingDataRecord(data: Record<string, unknown>): TuiBindingData | undefined {
  if (data.kind !== BINDING_KIND) return undefined;
  if (data.version !== BINDING_VERSION) return undefined;
  if (typeof data.command !== "string" || !data.command.trim()) return undefined;
  if (typeof data.cwd !== "string" || !data.cwd.trim()) return undefined;
  const args = Array.isArray(data.args)
    ? data.args.filter((a): a is string => typeof a === "string")
    : [];
  const mode: TuiMode = data.mode === "tui" ? "tui" : "txt";
  const startedAt = typeof data.startedAt === "number" ? data.startedAt : Date.now();
  return { command: data.command, args, cwd: data.cwd, mode, startedAt };
}
