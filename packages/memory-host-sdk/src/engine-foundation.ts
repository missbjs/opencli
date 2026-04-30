// Real workspace contract for memory engine foundation concerns.

export {
  resolveAgentContextLimits,
  resolveAgentDir,
  resolveAgentWorkspaceDir,
  resolveDefaultAgentId,
  resolveSessionAgentId,
} from "./host/opencli-runtime-agent.js";
export {
  resolveMemorySearchConfig,
  resolveMemorySearchSyncConfig,
  type ResolvedMemorySearchConfig,
  type ResolvedMemorySearchSyncConfig,
} from "./host/opencli-runtime-agent.js";
export { parseDurationMs } from "./host/opencli-runtime-config.js";
export { loadConfig } from "./host/opencli-runtime-config.js";
export { resolveStateDir } from "./host/opencli-runtime-config.js";
export { resolveSessionTranscriptsDirForAgent } from "./host/opencli-runtime-config.js";
export {
  hasConfiguredSecretInput,
  normalizeResolvedSecretInputString,
} from "./host/opencli-runtime-config.js";
export { writeFileWithinRoot } from "./host/opencli-runtime-io.js";
export { createSubsystemLogger } from "./host/opencli-runtime-io.js";
export { detectMime } from "./host/opencli-runtime-io.js";
export { resolveGlobalSingleton } from "./host/opencli-runtime-io.js";
export { onSessionTranscriptUpdate } from "./host/opencli-runtime-session.js";
export { splitShellArgs } from "./host/opencli-runtime-io.js";
export { runTasksWithConcurrency } from "./host/opencli-runtime-io.js";
export {
  shortenHomeInString,
  shortenHomePath,
  resolveUserPath,
  truncateUtf16Safe,
} from "./host/opencli-runtime-io.js";
export type { OpenCLIConfig } from "./host/opencli-runtime-config.js";
export type { SessionSendPolicyConfig } from "./host/opencli-runtime-config.js";
export type { SecretInput } from "./host/opencli-runtime-config.js";
export type {
  MemoryBackend,
  MemoryCitationsMode,
  MemoryQmdConfig,
  MemoryQmdIndexPath,
  MemoryQmdMcporterConfig,
  MemoryQmdSearchMode,
} from "./host/opencli-runtime-config.js";
export type { MemorySearchConfig } from "./host/opencli-runtime-config.js";
