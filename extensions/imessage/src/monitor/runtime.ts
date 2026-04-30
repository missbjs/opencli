import { createNonExitingRuntime, type RuntimeEnv } from "opencli/plugin-sdk/runtime-env";
import { normalizeStringEntries } from "opencli/plugin-sdk/text-runtime";
import type { MonitorIMessageOpts } from "./types.js";

export function resolveRuntime(opts: MonitorIMessageOpts): RuntimeEnv {
  return opts.runtime ?? createNonExitingRuntime();
}

export function normalizeAllowList(list?: Array<string | number>) {
  return normalizeStringEntries(list);
}
