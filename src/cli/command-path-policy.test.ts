import { afterEach, describe, expect, it, vi } from "vitest";
import type { CliCommandCatalogEntry } from "./command-catalog.js";
import {
  resolveCliCatalogCommandPath,
  resolveCliCommandPathPolicy,
  resolveCliNetworkProxyPolicy,
} from "./command-path-policy.js";

describe("command-path-policy", () => {
  afterEach(() => {
    vi.doUnmock("./command-catalog.js");
    vi.resetModules();
  });

  it("resolves status policy with shared startup semantics", () => {
    expect(resolveCliCommandPathPolicy(["status"])).toEqual({
      bypassConfigGuard: false,
      routeConfigGuard: "when-suppressed",
      loadPlugins: "never",
      hideBanner: false,
      ensureCliPath: false,
      networkProxy: "bypass",
    });
  });

  it("applies exact overrides after broader channel plugin rules", () => {
    expect(resolveCliCommandPathPolicy(["channels", "send"])).toEqual({
      bypassConfigGuard: false,
      routeConfigGuard: "never",
      loadPlugins: "always",
      hideBanner: false,
      ensureCliPath: true,
      networkProxy: "default",
    });
    expect(resolveCliCommandPathPolicy(["channels", "add"])).toEqual({
      bypassConfigGuard: false,
      routeConfigGuard: "never",
      loadPlugins: "never",
      hideBanner: false,
      ensureCliPath: true,
      networkProxy: "bypass",
    });
    expect(resolveCliCommandPathPolicy(["channels", "status"])).toEqual({
      bypassConfigGuard: false,
      routeConfigGuard: "never",
      loadPlugins: "never",
      hideBanner: false,
      ensureCliPath: true,
      networkProxy: expect.any(Function),
    });
    expect(resolveCliCommandPathPolicy(["channels", "list"])).toEqual({
      bypassConfigGuard: false,
      routeConfigGuard: "never",
      loadPlugins: "never",
      hideBanner: false,
      ensureCliPath: true,
      networkProxy: "bypass",
    });
    expect(resolveCliCommandPathPolicy(["channels", "logs"])).toEqual({
      bypassConfigGuard: false,
      routeConfigGuard: "never",
      loadPlugins: "never",
      hideBanner: false,
      ensureCliPath: true,
      networkProxy: "bypass",
    });
  });

  it("keeps config-only agent commands on config-only startup", () => {
    expect(resolveCliCommandPathPolicy(["agent"])).toEqual({
      bypassConfigGuard: false,
      routeConfigGuard: "never",
      loadPlugins: expect.any(Function),
      hideBanner: false,
      ensureCliPath: true,
      networkProxy: expect.any(Function),
    });

    for (const commandPath of [
      ["agents", "bind"],
      ["agents", "bindings"],
      ["agents", "unbind"],
      ["agents", "set-identity"],
      ["agents", "delete"],
    ]) {
      expect(resolveCliCommandPathPolicy(commandPath)).toEqual({
        bypassConfigGuard: false,
        routeConfigGuard: "never",
        loadPlugins: "never",
        hideBanner: false,
        ensureCliPath: true,
        networkProxy: "bypass",
      });
    }
  });

  it("resolves mixed startup-only rules", () => {
    expect(resolveCliCommandPathPolicy(["configure"])).toEqual({
      bypassConfigGuard: true,
      routeConfigGuard: "never",
      loadPlugins: "never",
      hideBanner: false,
      ensureCliPath: true,
      networkProxy: "default",
    });
    expect(resolveCliCommandPathPolicy(["config", "validate"])).toEqual({
      bypassConfigGuard: true,
      routeConfigGuard: "never",
      loadPlugins: "never",
      hideBanner: false,
      ensureCliPath: true,
      networkProxy: "bypass",
    });
    expect(resolveCliCommandPathPolicy(["gateway", "status"])).toEqual({
      bypassConfigGuard: false,
      routeConfigGuard: "always",
      loadPlugins: "never",
      hideBanner: false,
      ensureCliPath: true,
      networkProxy: "bypass",
    });
    expect(resolveCliCommandPathPolicy(["plugins", "update"])).toEqual({
      bypassConfigGuard: false,
      routeConfigGuard: "never",
      loadPlugins: "never",
      hideBanner: true,
      ensureCliPath: true,
      networkProxy: "default",
    });
    for (const commandPath of [
      ["plugins", "install"],
      ["plugins", "list"],
      ["plugins", "inspect"],
      ["plugins", "registry"],
      ["plugins", "doctor"],
    ]) {
      expect(resolveCliCommandPathPolicy(commandPath)).toEqual({
        bypassConfigGuard: false,
        routeConfigGuard: "never",
        loadPlugins: "never",
        hideBanner: false,
        ensureCliPath: true,
        networkProxy: "default",
      });
    }
    expect(resolveCliCommandPathPolicy(["cron", "list"])).toEqual({
      bypassConfigGuard: true,
      routeConfigGuard: "never",
      loadPlugins: "never",
      hideBanner: false,
      ensureCliPath: true,
      networkProxy: "bypass",
    });
  });

  it("defaults unknown command paths to network proxy routing", () => {
    expect(resolveCliNetworkProxyPolicy(["node", "opencli", "googlemeet", "login"])).toBe(
      "default",
    );
    expect(resolveCliNetworkProxyPolicy(["node", "opencli", "tools", "effective"])).toBe("bypass");
  });

  it("resolves static network proxy bypass policies from the catalog", () => {
    expect(resolveCliNetworkProxyPolicy(["node", "opencli", "status"])).toBe("bypass");
    expect(
      resolveCliNetworkProxyPolicy(["node", "opencli", "config", "get", "proxy.enabled"]),
    ).toBe("bypass");
    expect(resolveCliNetworkProxyPolicy(["node", "opencli", "proxy", "start"])).toBe("bypass");
  });

  it("resolves mixed network proxy policies from argv-sensitive catalog entries", () => {
    expect(resolveCliNetworkProxyPolicy(["node", "opencli", "gateway"])).toBe("default");
    expect(resolveCliNetworkProxyPolicy(["node", "opencli", "gateway", "run"])).toBe("default");
    expect(resolveCliNetworkProxyPolicy(["node", "opencli", "gateway", "health"])).toBe("bypass");
    expect(resolveCliNetworkProxyPolicy(["node", "opencli", "node", "run"])).toBe("default");
    expect(resolveCliNetworkProxyPolicy(["node", "opencli", "node", "status"])).toBe("bypass");
    expect(resolveCliNetworkProxyPolicy(["node", "opencli", "agent", "--local"])).toBe("default");
    expect(resolveCliNetworkProxyPolicy(["node", "opencli", "agent", "run"])).toBe("bypass");
    expect(resolveCliNetworkProxyPolicy(["node", "opencli", "channels", "status"])).toBe("bypass");
    expect(resolveCliNetworkProxyPolicy(["node", "opencli", "channels", "status", "--probe"])).toBe(
      "default",
    );
    expect(resolveCliNetworkProxyPolicy(["node", "opencli", "models", "status"])).toBe("bypass");
    expect(resolveCliNetworkProxyPolicy(["node", "opencli", "models", "status", "--probe"])).toBe(
      "default",
    );
    expect(resolveCliNetworkProxyPolicy(["node", "opencli", "skills", "info", "browser"])).toBe(
      "bypass",
    );
    expect(resolveCliNetworkProxyPolicy(["node", "opencli", "skills", "search", "browser"])).toBe(
      "default",
    );
  });

  it("uses the longest catalog command path for deep network proxy overrides", async () => {
    const catalog: readonly CliCommandCatalogEntry[] = [
      { commandPath: ["nodes"], policy: { networkProxy: "bypass" } },
      {
        commandPath: ["nodes", "camera", "snap"],
        exact: true,
        policy: { networkProxy: "default" },
      },
    ];

    vi.resetModules();
    vi.doMock("./command-catalog.js", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./command-catalog.js")>();
      return { ...actual, cliCommandCatalog: catalog };
    });
    const { resolveCliCatalogCommandPath, resolveCliNetworkProxyPolicy } =
      await import("./command-path-policy.js");

    expect(resolveCliCatalogCommandPath(["node", "opencli", "nodes", "camera", "snap"])).toEqual([
      "nodes",
      "camera",
      "snap",
    ]);
    expect(resolveCliNetworkProxyPolicy(["node", "opencli", "nodes", "camera", "snap"])).toBe(
      "default",
    );
    expect(resolveCliNetworkProxyPolicy(["node", "opencli", "nodes", "camera", "list"])).toBe(
      "bypass",
    );
  });

  it("stops catalog command path resolution before positional arguments", () => {
    expect(
      resolveCliCatalogCommandPath(["node", "opencli", "config", "get", "proxy.enabled"]),
    ).toEqual(["config", "get"]);
    expect(
      resolveCliCatalogCommandPath(["node", "opencli", "message", "send", "--to", "demo"]),
    ).toEqual(["message"]);
  });

  it("treats bare gateway invocations with options as the gateway runtime", () => {
    const argv = ["node", "opencli", "gateway", "--port", "1234"];

    expect(resolveCliCatalogCommandPath(argv)).toEqual(["gateway"]);
    expect(resolveCliNetworkProxyPolicy(argv)).toBe("default");
  });

  it("does not let gateway run option values spoof bypass subcommands", () => {
    for (const argv of [
      ["node", "opencli", "gateway", "--token", "status"],
      ["node", "opencli", "gateway", "--token=status"],
      ["node", "opencli", "gateway", "--password", "health"],
      ["node", "opencli", "gateway", "--password-file", "status"],
      ["node", "opencli", "gateway", "--ws-log", "compact"],
    ]) {
      expect(resolveCliCatalogCommandPath(argv), argv.join(" ")).toEqual(["gateway"]);
      expect(resolveCliNetworkProxyPolicy(argv), argv.join(" ")).toBe("default");
    }
  });

  it("still resolves real gateway bypass subcommands after their command token", () => {
    expect(resolveCliCatalogCommandPath(["node", "opencli", "gateway", "status"])).toEqual([
      "gateway",
      "status",
    ]);
    expect(
      resolveCliCatalogCommandPath(["node", "opencli", "gateway", "status", "--token", "secret"]),
    ).toEqual(["gateway", "status"]);
    expect(resolveCliNetworkProxyPolicy(["node", "opencli", "gateway", "status"])).toBe("bypass");
  });
});
