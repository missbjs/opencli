import { importFreshModule } from "opencli/plugin-sdk/test-fixtures";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadConfigMock = vi.hoisted(() => vi.fn());

vi.mock("../config/config.js", () => ({ getRuntimeConfig: loadConfigMock }));

describe("agents/context eager warmup", () => {
  const originalArgv = process.argv.slice();

  beforeEach(() => {
    loadConfigMock.mockReset();
  });

  afterEach(() => {
    process.argv = originalArgv.slice();
  });

  it.each([
    ["models", ["node", "opencli", "models", "set", "openai/gpt-5.4"]],
    ["agent", ["node", "opencli", "agent", "--message", "ok"]],
    ["memory", ["node", "opencli", "memory", "search", "--json"]],
  ])("does not eager-load config for %s commands on import", async (_label, argv) => {
    process.argv = argv;
    await importFreshModule(import.meta.url, `./context.js?scope=${_label}`);

    expect(loadConfigMock).not.toHaveBeenCalled();
  });
});
