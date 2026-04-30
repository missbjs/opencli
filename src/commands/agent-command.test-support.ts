import path from "node:path";
import { withTempHome as withTempHomeBase } from "opencli/plugin-sdk/test-env";
import type { OpenCLIConfig } from "../config/types.opencli.js";

type AgentDefaultConfig = NonNullable<NonNullable<OpenCLIConfig["agents"]>["defaults"]>;
type LoadConfigMock = {
  mockReturnValue(value: OpenCLIConfig): unknown;
};

export async function withAgentCommandTempHome<T>(
  prefix: string,
  fn: (home: string) => Promise<T>,
): Promise<T> {
  return withTempHomeBase(fn, { prefix });
}

export function mockAgentCommandConfig(
  configSpy: LoadConfigMock,
  home: string,
  storePath: string,
  agentOverrides?: Partial<AgentDefaultConfig>,
): OpenCLIConfig {
  const cfg = {
    agents: {
      defaults: {
        model: { primary: "anthropic/claude-opus-4-6" },
        models: { "anthropic/claude-opus-4-6": {} },
        workspace: path.join(home, "opencli"),
        ...agentOverrides,
      },
    },
    session: { store: storePath, mainKey: "main" },
  } as OpenCLIConfig;
  configSpy.mockReturnValue(cfg);
  return cfg;
}

export function createDefaultAgentCommandResult() {
  return {
    payloads: [{ text: "ok" }],
    meta: {
      durationMs: 5,
      agentMeta: { sessionId: "s", provider: "p", model: "m" },
    },
  };
}
