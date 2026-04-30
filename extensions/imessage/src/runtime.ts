import type { PluginRuntime } from "opencli/plugin-sdk/core";
import { createPluginRuntimeStore } from "opencli/plugin-sdk/runtime-store";

const { setRuntime: setIMessageRuntime, getRuntime: getIMessageRuntime } =
  createPluginRuntimeStore<PluginRuntime>({
    pluginId: "imessage",
    errorMessage: "iMessage runtime not initialized",
  });
export { getIMessageRuntime, setIMessageRuntime };
