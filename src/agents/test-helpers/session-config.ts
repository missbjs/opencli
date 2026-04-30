import type { OpenCLIConfig } from "../../config/types.opencli.js";

export function createPerSenderSessionConfig(
  overrides: Partial<NonNullable<OpenCLIConfig["session"]>> = {},
): NonNullable<OpenCLIConfig["session"]> {
  return {
    mainKey: "main",
    scope: "per-sender",
    ...overrides,
  };
}
