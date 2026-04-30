import type { PluginRuntime } from "opencli/plugin-sdk/core";
import { createPluginRuntimeStore } from "opencli/plugin-sdk/runtime-store";

const { setRuntime: setNostrRuntime, getRuntime: getNostrRuntime } =
  createPluginRuntimeStore<PluginRuntime>({
    pluginId: "nostr",
    errorMessage: "Nostr runtime not initialized",
  });
export { getNostrRuntime, setNostrRuntime };
