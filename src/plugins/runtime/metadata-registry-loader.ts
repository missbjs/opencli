import type { OpenCLIConfig } from "../../config/types.opencli.js";
import { loadOpenCLIPlugins } from "../loader.js";
import { hasExplicitPluginIdScope } from "../plugin-scope.js";
import type { PluginRegistry } from "../registry.js";
import type { PluginLogger } from "../types.js";
import { buildPluginRuntimeLoadOptions, resolvePluginRuntimeLoadContext } from "./load-context.js";

export function loadPluginMetadataRegistrySnapshot(options?: {
  config?: OpenCLIConfig;
  activationSourceConfig?: OpenCLIConfig;
  env?: NodeJS.ProcessEnv;
  logger?: PluginLogger;
  workspaceDir?: string;
  onlyPluginIds?: string[];
  loadModules?: boolean;
}): PluginRegistry {
  const context = resolvePluginRuntimeLoadContext(options);

  return loadOpenCLIPlugins(
    buildPluginRuntimeLoadOptions(context, {
      throwOnLoadError: true,
      cache: false,
      activate: false,
      mode: "validate",
      loadModules: options?.loadModules,
      ...(hasExplicitPluginIdScope(options?.onlyPluginIds)
        ? { onlyPluginIds: options?.onlyPluginIds }
        : {}),
    }),
  );
}
