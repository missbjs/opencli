// Focused runtime contract for memory plugin config/state/helpers.

export type { AnyAgentTool } from "./host/opencli-runtime-agent.js";
export { resolveCronStyleNow } from "./host/opencli-runtime-agent.js";
export { DEFAULT_PI_COMPACTION_RESERVE_TOKENS_FLOOR } from "./host/opencli-runtime-agent.js";
export { resolveDefaultAgentId, resolveSessionAgentId } from "./host/opencli-runtime-agent.js";
export { resolveMemorySearchConfig } from "./host/opencli-runtime-agent.js";
export {
  asToolParamsRecord,
  jsonResult,
  readNumberParam,
  readStringParam,
} from "./host/opencli-runtime-agent.js";
export { SILENT_REPLY_TOKEN } from "./host/opencli-runtime-session.js";
export { parseNonNegativeByteSize } from "./host/opencli-runtime-config.js";
export {
  getRuntimeConfig,
  /** @deprecated Use getRuntimeConfig(), or pass the already loaded config through the call path. */
  loadConfig,
} from "./host/opencli-runtime-config.js";
export { resolveStateDir } from "./host/opencli-runtime-config.js";
export { resolveSessionTranscriptsDirForAgent } from "./host/opencli-runtime-config.js";
export { emptyPluginConfigSchema } from "./host/opencli-runtime-memory.js";
export {
  buildActiveMemoryPromptSection,
  getMemoryCapabilityRegistration,
  listActiveMemoryPublicArtifacts,
} from "./host/opencli-runtime-memory.js";
export { parseAgentSessionKey } from "./host/opencli-runtime-agent.js";
export type { OpenCLIConfig } from "./host/opencli-runtime-config.js";
export type { MemoryCitationsMode } from "./host/opencli-runtime-config.js";
export type {
  MemoryFlushPlan,
  MemoryFlushPlanResolver,
  MemoryPluginCapability,
  MemoryPluginPublicArtifact,
  MemoryPluginPublicArtifactsProvider,
  MemoryPluginRuntime,
  MemoryPromptSectionBuilder,
} from "./host/opencli-runtime-memory.js";
export type { OpenCLIPluginApi } from "./host/opencli-runtime-memory.js";
