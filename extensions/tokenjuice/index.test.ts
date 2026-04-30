import fs from "node:fs";
import { createTestPluginApi } from "opencli/plugin-sdk/plugin-test-api";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { tokenjuiceFactory, createTokenjuiceOpenCLIEmbeddedExtension } = vi.hoisted(() => {
  const tokenjuiceFactory = vi.fn();
  const createTokenjuiceOpenCLIEmbeddedExtension = vi.fn(() => tokenjuiceFactory);
  return {
    tokenjuiceFactory,
    createTokenjuiceOpenCLIEmbeddedExtension,
  };
});

vi.mock("./runtime-api.js", () => ({
  createTokenjuiceOpenCLIEmbeddedExtension,
}));

import plugin from "./index.js";

describe("tokenjuice bundled plugin", () => {
  beforeEach(() => {
    createTokenjuiceOpenCLIEmbeddedExtension.mockClear();
    tokenjuiceFactory.mockClear();
  });

  it("is opt-in by default", () => {
    const manifest = JSON.parse(
      fs.readFileSync(new URL("./opencli.plugin.json", import.meta.url), "utf8"),
    ) as { enabledByDefault?: unknown };

    expect(manifest.enabledByDefault).toBeUndefined();
  });

  it("registers tokenjuice tool result middleware for Pi and Codex runtimes", () => {
    const registerAgentToolResultMiddleware = vi.fn();

    plugin.register(
      createTestPluginApi({
        id: "tokenjuice",
        name: "tokenjuice",
        source: "test",
        config: {},
        pluginConfig: {},
        runtime: {} as never,
        registerAgentToolResultMiddleware,
      }),
    );

    expect(createTokenjuiceOpenCLIEmbeddedExtension).toHaveBeenCalledTimes(1);
    expect(tokenjuiceFactory).toHaveBeenCalledTimes(1);
    expect(registerAgentToolResultMiddleware).toHaveBeenCalledWith(expect.any(Function), {
      runtimes: ["pi", "codex"],
    });
  });
});
