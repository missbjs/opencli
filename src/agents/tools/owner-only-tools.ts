export const OPENCLI_OWNER_ONLY_CORE_TOOL_NAMES = ["cron", "gateway", "nodes"] as const;

const OPENCLI_OWNER_ONLY_CORE_TOOL_NAME_SET: ReadonlySet<string> = new Set(
  OPENCLI_OWNER_ONLY_CORE_TOOL_NAMES,
);

export function isOpenCLIOwnerOnlyCoreToolName(toolName: string): boolean {
  return OPENCLI_OWNER_ONLY_CORE_TOOL_NAME_SET.has(toolName);
}
