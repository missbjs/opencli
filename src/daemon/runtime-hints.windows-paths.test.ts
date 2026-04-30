import { beforeAll, describe, expect, it, vi } from "vitest";

const resolveGatewayLogPathsMock = vi.fn(() => ({
  logDir: "C:\\tmp\\opencli-state\\logs",
  stdoutPath: "C:\\tmp\\opencli-state\\logs\\gateway.log",
  stderrPath: "C:\\tmp\\opencli-state\\logs\\gateway.err.log",
}));
const resolveGatewayRestartLogPathMock = vi.fn(
  () => "C:\\tmp\\opencli-state\\logs\\gateway-restart.log",
);

vi.mock("./restart-logs.js", () => ({
  resolveGatewayLogPaths: resolveGatewayLogPathsMock,
  resolveGatewayRestartLogPath: resolveGatewayRestartLogPathMock,
}));

let buildPlatformRuntimeLogHints: typeof import("./runtime-hints.js").buildPlatformRuntimeLogHints;

describe("buildPlatformRuntimeLogHints", () => {
  beforeAll(async () => {
    ({ buildPlatformRuntimeLogHints } = await import("./runtime-hints.js"));
  });

  it("strips windows drive prefixes from darwin display paths", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "darwin",
        systemdServiceName: "opencli-gateway",
        windowsTaskName: "OpenCLI Gateway",
      }),
    ).toEqual([
      "Launchd stdout (if installed): /tmp/opencli-state/logs/gateway.log",
      "Launchd stderr (if installed): /tmp/opencli-state/logs/gateway.err.log",
      "Restart attempts: /tmp/opencli-state/logs/gateway-restart.log",
    ]);
  });
});
