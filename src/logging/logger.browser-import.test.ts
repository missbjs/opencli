import { importFreshModule } from "opencli/plugin-sdk/test-fixtures";
import { afterEach, describe, expect, it, vi } from "vitest";

type LoggerModule = typeof import("./logger.js");

const originalGetBuiltinModule = (
  process as NodeJS.Process & { getBuiltinModule?: (id: string) => unknown }
).getBuiltinModule;

async function importBrowserSafeLogger(params?: {
  resolvePreferredOpenCLITmpDir?: ReturnType<typeof vi.fn>;
}): Promise<{
  module: LoggerModule;
  resolvePreferredOpenCLITmpDir: ReturnType<typeof vi.fn>;
}> {
  const resolvePreferredOpenCLITmpDir =
    params?.resolvePreferredOpenCLITmpDir ??
    vi.fn(() => {
      throw new Error("resolvePreferredOpenCLITmpDir should not run during browser-safe import");
    });

  vi.doMock("../infra/tmp-opencli-dir.js", async () => {
    const actual = await vi.importActual<typeof import("../infra/tmp-opencli-dir.js")>(
      "../infra/tmp-opencli-dir.js",
    );
    return {
      ...actual,
      resolvePreferredOpenCLITmpDir,
    };
  });

  Object.defineProperty(process, "getBuiltinModule", {
    configurable: true,
    value: undefined,
  });

  const module = await importFreshModule<LoggerModule>(
    import.meta.url,
    "./logger.js?scope=browser-safe",
  );
  return { module, resolvePreferredOpenCLITmpDir };
}

describe("logging/logger browser-safe import", () => {
  afterEach(() => {
    vi.doUnmock("../infra/tmp-opencli-dir.js");
    Object.defineProperty(process, "getBuiltinModule", {
      configurable: true,
      value: originalGetBuiltinModule,
    });
  });

  it("does not resolve the preferred temp dir at import time when node fs is unavailable", async () => {
    const { module, resolvePreferredOpenCLITmpDir } = await importBrowserSafeLogger();

    expect(resolvePreferredOpenCLITmpDir).not.toHaveBeenCalled();
    expect(module.DEFAULT_LOG_DIR).toBe("/tmp/opencli");
    expect(module.DEFAULT_LOG_FILE).toBe("/tmp/opencli/opencli.log");
  });

  it("disables file logging when imported in a browser-like environment", async () => {
    const { module, resolvePreferredOpenCLITmpDir } = await importBrowserSafeLogger();

    expect(module.getResolvedLoggerSettings()).toMatchObject({
      level: "silent",
      file: "/tmp/opencli/opencli.log",
    });
    expect(module.isFileLogLevelEnabled("info")).toBe(false);
    expect(() => module.getLogger().info("browser-safe")).not.toThrow();
    expect(resolvePreferredOpenCLITmpDir).not.toHaveBeenCalled();
  });
});
