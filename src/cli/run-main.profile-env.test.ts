import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fileState = vi.hoisted(() => ({
  hasCliDotEnv: false,
}));

const dotenvState = vi.hoisted(() => {
  const state = {
    profileAtDotenvLoad: undefined as string | undefined,
    containerAtDotenvLoad: undefined as string | undefined,
  };
  return {
    state,
    loadDotEnv: vi.fn(() => {
      state.profileAtDotenvLoad = process.env.OPENCLI_PROFILE;
      state.containerAtDotenvLoad = process.env.OPENCLI_CONTAINER;
    }),
  };
});

const maybeRunCliInContainerMock = vi.hoisted(() =>
  vi.fn((argv: string[]) => ({ handled: false, argv })),
);

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  type ExistsSyncPath = Parameters<typeof actual.existsSync>[0];
  return {
    ...actual,
    existsSync: vi.fn((target: ExistsSyncPath) => {
      if (typeof target === "string" && target.endsWith(".env")) {
        return fileState.hasCliDotEnv;
      }
      return actual.existsSync(target);
    }),
  };
});

vi.mock("./dotenv.js", () => ({
  loadCliDotEnv: dotenvState.loadDotEnv,
}));

vi.mock("../infra/env.js", () => ({
  isTruthyEnvValue: (value?: string) =>
    typeof value === "string" && ["1", "on", "true", "yes"].includes(value.trim().toLowerCase()),
  normalizeEnv: vi.fn(),
}));

vi.mock("../infra/runtime-guard.js", () => ({
  assertSupportedRuntime: vi.fn(),
}));

vi.mock("../infra/path-env.js", () => ({
  ensureOpenCLICliOnPath: vi.fn(),
}));

vi.mock("./route.js", () => ({
  tryRouteCli: vi.fn(async () => true),
}));

vi.mock("./windows-argv.js", () => ({
  normalizeWindowsArgv: (argv: string[]) => argv,
}));

vi.mock("./container-target.js", async () => {
  const actual =
    await vi.importActual<typeof import("./container-target.js")>("./container-target.js");
  return {
    ...actual,
    maybeRunCliInContainer: maybeRunCliInContainerMock,
  };
});

import { runCli } from "./run-main.js";

describe("runCli profile env bootstrap", () => {
  const originalProfile = process.env.OPENCLI_PROFILE;
  const originalStateDir = process.env.OPENCLI_STATE_DIR;
  const originalConfigPath = process.env.OPENCLI_CONFIG_PATH;
  const originalContainer = process.env.OPENCLI_CONTAINER;
  const originalGatewayPort = process.env.OPENCLI_GATEWAY_PORT;
  const originalGatewayUrl = process.env.OPENCLI_GATEWAY_URL;
  const originalGatewayToken = process.env.OPENCLI_GATEWAY_TOKEN;
  const originalGatewayPassword = process.env.OPENCLI_GATEWAY_PASSWORD;

  beforeEach(() => {
    delete process.env.OPENCLI_PROFILE;
    delete process.env.OPENCLI_STATE_DIR;
    delete process.env.OPENCLI_CONFIG_PATH;
    delete process.env.OPENCLI_CONTAINER;
    delete process.env.OPENCLI_GATEWAY_PORT;
    delete process.env.OPENCLI_GATEWAY_URL;
    delete process.env.OPENCLI_GATEWAY_TOKEN;
    delete process.env.OPENCLI_GATEWAY_PASSWORD;
    dotenvState.state.profileAtDotenvLoad = undefined;
    dotenvState.state.containerAtDotenvLoad = undefined;
    dotenvState.loadDotEnv.mockClear();
    maybeRunCliInContainerMock.mockClear();
    fileState.hasCliDotEnv = false;
  });

  afterEach(() => {
    if (originalProfile === undefined) {
      delete process.env.OPENCLI_PROFILE;
    } else {
      process.env.OPENCLI_PROFILE = originalProfile;
    }
    if (originalContainer === undefined) {
      delete process.env.OPENCLI_CONTAINER;
    } else {
      process.env.OPENCLI_CONTAINER = originalContainer;
    }
    if (originalStateDir === undefined) {
      delete process.env.OPENCLI_STATE_DIR;
    } else {
      process.env.OPENCLI_STATE_DIR = originalStateDir;
    }
    if (originalConfigPath === undefined) {
      delete process.env.OPENCLI_CONFIG_PATH;
    } else {
      process.env.OPENCLI_CONFIG_PATH = originalConfigPath;
    }
    if (originalGatewayPort === undefined) {
      delete process.env.OPENCLI_GATEWAY_PORT;
    } else {
      process.env.OPENCLI_GATEWAY_PORT = originalGatewayPort;
    }
    if (originalGatewayUrl === undefined) {
      delete process.env.OPENCLI_GATEWAY_URL;
    } else {
      process.env.OPENCLI_GATEWAY_URL = originalGatewayUrl;
    }
    if (originalGatewayToken === undefined) {
      delete process.env.OPENCLI_GATEWAY_TOKEN;
    } else {
      process.env.OPENCLI_GATEWAY_TOKEN = originalGatewayToken;
    }
    if (originalGatewayPassword === undefined) {
      delete process.env.OPENCLI_GATEWAY_PASSWORD;
    } else {
      process.env.OPENCLI_GATEWAY_PASSWORD = originalGatewayPassword;
    }
  });

  it("applies --profile before dotenv loading", async () => {
    fileState.hasCliDotEnv = true;
    await runCli(["node", "opencli", "--profile", "rawdog", "status"]);

    expect(dotenvState.loadDotEnv).toHaveBeenCalledOnce();
    expect(dotenvState.state.profileAtDotenvLoad).toBe("rawdog");
    expect(process.env.OPENCLI_PROFILE).toBe("rawdog");
  });

  it("rejects --container combined with --profile", async () => {
    await expect(
      runCli(["node", "opencli", "--container", "demo", "--profile", "rawdog", "status"]),
    ).rejects.toThrow("--container cannot be combined with --profile/--dev");

    expect(dotenvState.loadDotEnv).not.toHaveBeenCalled();
    expect(process.env.OPENCLI_PROFILE).toBe("rawdog");
  });

  it("rejects --container combined with interleaved --profile", async () => {
    await expect(
      runCli(["node", "opencli", "status", "--container", "demo", "--profile", "rawdog"]),
    ).rejects.toThrow("--container cannot be combined with --profile/--dev");
  });

  it("rejects --container combined with interleaved --dev", async () => {
    await expect(
      runCli(["node", "opencli", "status", "--container", "demo", "--dev"]),
    ).rejects.toThrow("--container cannot be combined with --profile/--dev");
  });

  it("does not let dotenv change container target resolution", async () => {
    fileState.hasCliDotEnv = true;
    dotenvState.loadDotEnv.mockImplementationOnce(() => {
      process.env.OPENCLI_CONTAINER = "demo";
      dotenvState.state.profileAtDotenvLoad = process.env.OPENCLI_PROFILE;
      dotenvState.state.containerAtDotenvLoad = process.env.OPENCLI_CONTAINER;
    });

    await runCli(["node", "opencli", "status"]);

    expect(dotenvState.loadDotEnv).toHaveBeenCalledOnce();
    expect(process.env.OPENCLI_CONTAINER).toBe("demo");
    expect(dotenvState.state.containerAtDotenvLoad).toBe("demo");
    expect(maybeRunCliInContainerMock).toHaveBeenCalledWith(["node", "opencli", "status"]);
    expect(maybeRunCliInContainerMock).toHaveReturnedWith({
      handled: false,
      argv: ["node", "opencli", "status"],
    });
  });

  it("allows container mode when OPENCLI_PROFILE is already set in env", async () => {
    process.env.OPENCLI_PROFILE = "work";

    await expect(
      runCli(["node", "opencli", "--container", "demo", "status"]),
    ).resolves.toBeUndefined();
  });

  it.each([
    ["OPENCLI_GATEWAY_PORT", "19001"],
    ["OPENCLI_GATEWAY_URL", "ws://127.0.0.1:18789"],
    ["OPENCLI_GATEWAY_TOKEN", "demo-token"],
    ["OPENCLI_GATEWAY_PASSWORD", "demo-password"],
  ])("allows container mode when %s is set in env", async (key, value) => {
    process.env[key] = value;

    await expect(
      runCli(["node", "opencli", "--container", "demo", "status"]),
    ).resolves.toBeUndefined();
  });

  it("allows container mode when only OPENCLI_STATE_DIR is set in env", async () => {
    process.env.OPENCLI_STATE_DIR = "/tmp/opencli-host-state";

    await expect(
      runCli(["node", "opencli", "--container", "demo", "status"]),
    ).resolves.toBeUndefined();
  });

  it("allows container mode when only OPENCLI_CONFIG_PATH is set in env", async () => {
    process.env.OPENCLI_CONFIG_PATH = "/tmp/opencli-host-state/opencli.json";

    await expect(
      runCli(["node", "opencli", "--container", "demo", "status"]),
    ).resolves.toBeUndefined();
  });
});
