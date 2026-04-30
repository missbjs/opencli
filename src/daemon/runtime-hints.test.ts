import { describe, expect, it } from "vitest";
import { buildPlatformRuntimeLogHints, buildPlatformServiceStartHints } from "./runtime-hints.js";

describe("buildPlatformRuntimeLogHints", () => {
  it("renders launchd log hints on darwin", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "darwin",
        env: {
          OPENCLI_STATE_DIR: "/tmp/opencli-state",
          OPENCLI_LOG_PREFIX: "gateway",
        },
        systemdServiceName: "opencli-gateway",
        windowsTaskName: "OpenCLI Gateway",
      }),
    ).toEqual([
      "Launchd stdout (if installed): /tmp/opencli-state/logs/gateway.log",
      "Launchd stderr (if installed): /tmp/opencli-state/logs/gateway.err.log",
      "Restart attempts: /tmp/opencli-state/logs/gateway-restart.log",
    ]);
  });

  it("renders systemd and windows hints by platform", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "linux",
        env: {
          OPENCLI_STATE_DIR: "/tmp/opencli-state",
        },
        systemdServiceName: "opencli-gateway",
        windowsTaskName: "OpenCLI Gateway",
      }),
    ).toEqual([
      "Logs: journalctl --user -u opencli-gateway.service -n 200 --no-pager",
      "Restart attempts: /tmp/opencli-state/logs/gateway-restart.log",
    ]);
    expect(
      buildPlatformRuntimeLogHints({
        platform: "win32",
        env: {
          OPENCLI_STATE_DIR: "/tmp/opencli-state",
        },
        systemdServiceName: "opencli-gateway",
        windowsTaskName: "OpenCLI Gateway",
      }),
    ).toEqual([
      'Logs: schtasks /Query /TN "OpenCLI Gateway" /V /FO LIST',
      "Restart attempts: /tmp/opencli-state/logs/gateway-restart.log",
    ]);
  });
});

describe("buildPlatformServiceStartHints", () => {
  it("builds platform-specific service start hints", () => {
    expect(
      buildPlatformServiceStartHints({
        platform: "darwin",
        installCommand: "opencli gateway install",
        startCommand: "opencli gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.opencli.gateway.plist",
        systemdServiceName: "opencli-gateway",
        windowsTaskName: "OpenCLI Gateway",
      }),
    ).toEqual([
      "opencli gateway install",
      "opencli gateway",
      "launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.opencli.gateway.plist",
    ]);
    expect(
      buildPlatformServiceStartHints({
        platform: "linux",
        installCommand: "opencli gateway install",
        startCommand: "opencli gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.opencli.gateway.plist",
        systemdServiceName: "opencli-gateway",
        windowsTaskName: "OpenCLI Gateway",
      }),
    ).toEqual([
      "opencli gateway install",
      "opencli gateway",
      "systemctl --user start opencli-gateway.service",
    ]);
  });
});
