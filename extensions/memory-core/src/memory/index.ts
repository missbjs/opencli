export { MemoryIndexManager } from "./manager.js";
export type {
  MemoryEmbeddingProbeResult,
  MemorySearchManager,
  MemorySearchResult,
} from "opencli/plugin-sdk/memory-core-host-engine-storage";
export {
  closeAllMemorySearchManagers,
  getMemorySearchManager,
  type MemorySearchManagerPurpose,
  type MemorySearchManagerResult,
} from "./search-manager.js";
