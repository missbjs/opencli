import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SCRIPT_PATH = "scripts/e2e/parallels/npm-update-smoke.ts";
const UPDATE_SCRIPTS_PATH = "scripts/e2e/parallels/npm-update-scripts.ts";

describe("parallels npm update smoke", () => {
  it("does not leave guard/server children attached to the wrapper", () => {
    const script = readFileSync(SCRIPT_PATH, "utf8");

    expect(script).toContain("spawnLogged");
    expect(script).toContain('child.on("close"');
    expect(script).toContain("await this.server?.stop()");
  });

  it("scrubs future plugin entries before invoking old same-guest updaters", () => {
    const script = readFileSync(UPDATE_SCRIPTS_PATH, "utf8");

    expect(script).toContain("Remove-FuturePluginEntries");
    expect(script).toContain("scrub_future_plugin_entries");
    expect(script).toContain("delete plugins.entries.feishu");
    expect(script).toContain("delete plugins.entries.whatsapp");
    expect(script).toContain("Remove-FuturePluginEntries\nStop-OpenCLIGatewayProcesses");
    expect(script).toContain("scrub_future_plugin_entries\nstop_opencli_gateway_processes");
    expect(script).toContain("$env:OPENCLI_DISABLE_BUNDLED_PLUGINS = '1'");
    expect(script).toContain(
      "OPENCLI_DISABLE_BUNDLED_PLUGINS=1 /opt/homebrew/bin/opencli update --tag",
    );
    expect(script).toContain("OPENCLI_DISABLE_BUNDLED_PLUGINS=1 opencli update --tag");
    expect(script).toContain(
      "OPENCLI_DISABLE_BUNDLED_PLUGINS=1 /opt/homebrew/bin/opencli gateway stop",
    );
    expect(script).toContain("OPENCLI_DISABLE_BUNDLED_PLUGINS=1 opencli gateway stop");
  });
});
