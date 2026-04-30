import { describe, expect, it } from "vitest";
import type { PluginManifestCommandAliasRegistry } from "../plugins/manifest-command-aliases.js";
import {
  rewriteUpdateFlagArgv,
  resolveMissingPluginCommandMessage,
  shouldEnsureCliPath,
  shouldStartCrestodianForBareRoot,
  shouldStartCrestodianForModernOnboard,
  shouldStartProxyForCli,
  shouldUseBrowserHelpFastPath,
  shouldUseRootHelpFastPath,
} from "./run-main-policy.js";
import { isGatewayRunFastPathArgv } from "./run-main.js";

const memoryWikiCommandAliasRegistry: PluginManifestCommandAliasRegistry = {
  plugins: [
    {
      id: "memory-wiki",
      commandAliases: [{ name: "wiki" }],
    },
  ],
};

const memoryCoreCommandAliasRegistry: PluginManifestCommandAliasRegistry = {
  plugins: [
    {
      id: "memory-core",
      commandAliases: [{ name: "dreaming", kind: "runtime-slash", cliCommand: "memory" }],
    },
  ],
};

describe("isGatewayRunFastPathArgv", () => {
  it("matches only plain gateway foreground starts without root options or help", () => {
    expect(isGatewayRunFastPathArgv(["node", "opencli", "gateway"])).toBe(true);
    expect(isGatewayRunFastPathArgv(["node", "opencli", "gateway", "--force"])).toBe(true);
    expect(isGatewayRunFastPathArgv(["node", "opencli", "gateway", "--port", "18789"])).toBe(true);
    expect(isGatewayRunFastPathArgv(["node", "opencli", "gateway", "--auth=none"])).toBe(true);
    expect(
      isGatewayRunFastPathArgv(["node", "opencli", "--no-color", "gateway", "--bind", "loopback"]),
    ).toBe(true);
    expect(isGatewayRunFastPathArgv(["node", "opencli", "gateway", "run"])).toBe(true);
    expect(
      isGatewayRunFastPathArgv(["node", "opencli", "gateway", "run", "--raw-stream-path", "x"]),
    ).toBe(true);
    expect(isGatewayRunFastPathArgv(["node", "opencli", "gateway", "call", "health"])).toBe(false);
    expect(isGatewayRunFastPathArgv(["node", "opencli", "gateway", "--help"])).toBe(false);
    expect(isGatewayRunFastPathArgv(["node", "opencli", "gateway", "--port"])).toBe(false);
    expect(isGatewayRunFastPathArgv(["node", "opencli", "gateway", "--unknown"])).toBe(false);
  });
});

describe("rewriteUpdateFlagArgv", () => {
  it("leaves argv unchanged when --update is absent", () => {
    const argv = ["node", "entry.js", "status"];
    expect(rewriteUpdateFlagArgv(argv)).toBe(argv);
  });

  it("rewrites --update into the update command", () => {
    expect(rewriteUpdateFlagArgv(["node", "entry.js", "--update"])).toEqual([
      "node",
      "entry.js",
      "update",
    ]);
  });

  it("preserves global flags that appear before --update", () => {
    expect(rewriteUpdateFlagArgv(["node", "entry.js", "--profile", "p", "--update"])).toEqual([
      "node",
      "entry.js",
      "--profile",
      "p",
      "update",
    ]);
  });

  it("keeps update options after the rewritten command", () => {
    expect(rewriteUpdateFlagArgv(["node", "entry.js", "--update", "--json"])).toEqual([
      "node",
      "entry.js",
      "update",
      "--json",
    ]);
  });
});

describe("shouldEnsureCliPath", () => {
  it("skips path bootstrap for help/version invocations", () => {
    expect(shouldEnsureCliPath(["node", "opencli", "--help"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "opencli", "-V"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "opencli", "-v"])).toBe(false);
  });

  it("skips path bootstrap for read-only fast paths", () => {
    expect(shouldEnsureCliPath(["node", "opencli"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "opencli", "--profile", "work"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "opencli", "status"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "opencli", "--log-level", "debug", "status"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "opencli", "sessions", "--json"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "opencli", "config", "get", "update"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "opencli", "models", "status", "--json"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "opencli", "tools", "effective"])).toBe(false);
  });

  it("keeps path bootstrap for mutating or unknown commands", () => {
    expect(shouldEnsureCliPath(["node", "opencli", "message", "send"])).toBe(true);
    expect(shouldEnsureCliPath(["node", "opencli", "voicecall", "status"])).toBe(true);
    expect(shouldEnsureCliPath(["node", "opencli", "acp", "-v"])).toBe(true);
  });
});

describe("shouldStartCrestodianForBareRoot", () => {
  it("starts Crestodian for bare root invocations", () => {
    expect(shouldStartCrestodianForBareRoot(["node", "opencli"])).toBe(true);
    expect(shouldStartCrestodianForBareRoot(["node", "opencli", "--profile", "work"])).toBe(true);
    expect(shouldStartCrestodianForBareRoot(["node", "opencli", "--dev"])).toBe(true);
  });

  it("does not start Crestodian for help, version, or commands", () => {
    expect(shouldStartCrestodianForBareRoot(["node", "opencli", "--help"])).toBe(false);
    expect(shouldStartCrestodianForBareRoot(["node", "opencli", "-V"])).toBe(false);
    expect(shouldStartCrestodianForBareRoot(["node", "opencli", "status"])).toBe(false);
  });
});

describe("shouldStartCrestodianForModernOnboard", () => {
  it("starts Crestodian before heavy command registration for modern onboard", () => {
    expect(
      shouldStartCrestodianForModernOnboard([
        "node",
        "opencli",
        "onboard",
        "--modern",
        "--non-interactive",
        "--json",
      ]),
    ).toBe(true);
  });

  it("keeps classic onboard and help on the normal command path", () => {
    expect(shouldStartCrestodianForModernOnboard(["node", "opencli", "onboard"])).toBe(false);
    expect(
      shouldStartCrestodianForModernOnboard(["node", "opencli", "onboard", "--modern", "--help"]),
    ).toBe(false);
  });
});

describe("shouldStartProxyForCli", () => {
  it("starts managed proxy routing for the --update shorthand", () => {
    expect(shouldStartProxyForCli(["node", "opencli", "--update"])).toBe(true);
    expect(shouldStartProxyForCli(["node", "opencli", "--profile", "p", "--update"])).toBe(true);
  });
});

describe("shouldUseRootHelpFastPath", () => {
  it("uses the fast path for root help only", () => {
    expect(shouldUseRootHelpFastPath(["node", "opencli", "--help"])).toBe(true);
    expect(shouldUseRootHelpFastPath(["node", "opencli", "--profile", "work", "-h"])).toBe(true);
    expect(shouldUseRootHelpFastPath(["node", "opencli", "help", "--help"])).toBe(true);
    expect(shouldUseRootHelpFastPath(["node", "opencli", "tools", "--help"])).toBe(true);
    expect(shouldUseRootHelpFastPath(["node", "opencli", "status", "--help"])).toBe(false);
    expect(shouldUseRootHelpFastPath(["node", "opencli", "--help", "status"])).toBe(false);
    expect(shouldUseRootHelpFastPath(["node", "opencli", "help", "gateway"])).toBe(false);
  });
});

describe("shouldUseBrowserHelpFastPath", () => {
  it("uses the fast path for browser command help only", () => {
    expect(shouldUseBrowserHelpFastPath(["node", "opencli", "browser", "--help"])).toBe(true);
    expect(shouldUseBrowserHelpFastPath(["node", "opencli", "browser", "-h"])).toBe(true);
    expect(
      shouldUseBrowserHelpFastPath(["node", "opencli", "--profile", "work", "browser", "-h"]),
    ).toBe(true);
    expect(shouldUseBrowserHelpFastPath(["node", "opencli", "browser", "status", "--help"])).toBe(
      false,
    );
    expect(shouldUseBrowserHelpFastPath(["node", "opencli", "status", "--help"])).toBe(false);
  });
});

describe("resolveMissingPluginCommandMessage", () => {
  it("explains plugins.allow misses for a bundled plugin command", () => {
    expect(
      resolveMissingPluginCommandMessage("browser", {
        plugins: {
          allow: ["quietchat"],
        },
      }),
    ).toContain('`plugins.allow` excludes "browser"');
  });

  it("explains explicit bundled plugin disablement", () => {
    expect(
      resolveMissingPluginCommandMessage("browser", {
        plugins: {
          entries: {
            browser: {
              enabled: false,
            },
          },
        },
      }),
    ).toContain("plugins.entries.browser.enabled=false");
  });

  it("returns null when the bundled plugin command is already allowed", () => {
    expect(
      resolveMissingPluginCommandMessage("browser", {
        plugins: {
          allow: ["browser"],
        },
      }),
    ).toBeNull();
  });

  it("explains that dreaming is a runtime slash command, not a CLI command", () => {
    const message = resolveMissingPluginCommandMessage(
      "dreaming",
      {},
      {
        registry: memoryCoreCommandAliasRegistry,
      },
    );
    expect(message).toContain("runtime slash command");
    expect(message).toContain("/dreaming");
    expect(message).toContain("memory-core");
    expect(message).toContain("opencli memory");
  });

  it("returns the runtime command message even when plugins.allow is set", () => {
    const message = resolveMissingPluginCommandMessage(
      "dreaming",
      {
        plugins: {
          allow: ["memory-core"],
        },
      },
      {
        registry: memoryCoreCommandAliasRegistry,
      },
    );
    expect(message).toContain("runtime slash command");
    expect(message).not.toContain("plugins.allow");
  });

  it("points command names in plugins.allow at their parent plugin", () => {
    const message = resolveMissingPluginCommandMessage(
      "dreaming",
      {
        plugins: {
          allow: ["dreaming"],
        },
      },
      {
        registry: memoryCoreCommandAliasRegistry,
      },
    );
    expect(message).toContain('"dreaming" is not a plugin');
    expect(message).toContain('"memory-core"');
    expect(message).toContain("plugins.allow");
  });

  it("explains parent plugin disablement for runtime command aliases", () => {
    const message = resolveMissingPluginCommandMessage(
      "dreaming",
      {
        plugins: {
          entries: {
            "memory-core": {
              enabled: false,
            },
          },
        },
      },
      {
        registry: memoryCoreCommandAliasRegistry,
      },
    );
    expect(message).toContain("plugins.entries.memory-core.enabled=false");
    expect(message).not.toContain("runtime slash command");
  });

  it("allows CLI commands when their parent plugin is in plugins.allow", () => {
    const message = resolveMissingPluginCommandMessage(
      "wiki",
      {
        plugins: {
          allow: ["memory-wiki"],
        },
      },
      { registry: memoryWikiCommandAliasRegistry },
    );
    expect(message).toBeNull();
  });

  it("blocks CLI commands when parent plugin is NOT in plugins.allow", () => {
    const message = resolveMissingPluginCommandMessage(
      "wiki",
      {
        plugins: {
          allow: ["quietchat"],
        },
      },
      { registry: memoryWikiCommandAliasRegistry },
    );
    expect(message).not.toBeNull();
    expect(message).toContain('"memory-wiki"');
    expect(message).toContain("plugins.allow");
  });
});
