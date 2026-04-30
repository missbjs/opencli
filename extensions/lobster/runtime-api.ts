export { definePluginEntry } from "opencli/plugin-sdk/core";
export type {
  AnyAgentTool,
  OpenCLIPluginApi,
  OpenCLIPluginToolContext,
  OpenCLIPluginToolFactory,
} from "opencli/plugin-sdk/core";
export {
  applyWindowsSpawnProgramPolicy,
  materializeWindowsSpawnProgram,
  resolveWindowsSpawnProgramCandidate,
} from "opencli/plugin-sdk/windows-spawn";
