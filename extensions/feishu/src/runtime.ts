import type { PluginRuntime } from "opencli/plugin-sdk/core";
import { createPluginRuntimeStore } from "opencli/plugin-sdk/runtime-store";

const { setRuntime: setFeishuRuntime, getRuntime: getFeishuRuntime } =
  createPluginRuntimeStore<PluginRuntime>({
    pluginId: "feishu",
    errorMessage: "Feishu runtime not initialized",
  });
export { getFeishuRuntime, setFeishuRuntime };
