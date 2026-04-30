import { beforeEach, describe, expect, it, vi } from "vitest";

type LoadOpenCLIProviderIndex = typeof import("../model-catalog/index.js").loadOpenCLIProviderIndex;
type LoadPluginRegistrySnapshot = typeof import("./plugin-registry.js").loadPluginRegistrySnapshot;
type ResolveManifestProviderAuthChoices =
  typeof import("./provider-auth-choices.js").resolveManifestProviderAuthChoices;

const loadOpenCLIProviderIndex = vi.hoisted(() =>
  vi.fn<LoadOpenCLIProviderIndex>(() => ({ version: 1, providers: {} })),
);
vi.mock("../model-catalog/index.js", async () => {
  const actual = await vi.importActual<typeof import("../model-catalog/index.js")>(
    "../model-catalog/index.js",
  );
  return {
    ...actual,
    loadOpenCLIProviderIndex,
  };
});

const loadPluginRegistrySnapshot = vi.hoisted(() =>
  vi.fn<LoadPluginRegistrySnapshot>(() => ({
    version: 1,
    hostContractVersion: "test",
    compatRegistryVersion: "test",
    migrationVersion: 1,
    policyHash: "test",
    generatedAtMs: 0,
    installRecords: {},
    plugins: [],
    diagnostics: [],
  })),
);
vi.mock("./plugin-registry.js", () => ({
  loadPluginRegistrySnapshot,
}));

const resolveManifestProviderAuthChoices = vi.hoisted(() =>
  vi.fn<ResolveManifestProviderAuthChoices>(() => []),
);
vi.mock("./provider-auth-choices.js", () => ({
  resolveManifestProviderAuthChoices,
}));

import {
  resolveProviderInstallCatalogEntries,
  resolveProviderInstallCatalogEntry,
} from "./provider-install-catalog.js";

describe("provider install catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadOpenCLIProviderIndex.mockReturnValue({ version: 1, providers: {} });
    loadPluginRegistrySnapshot.mockReturnValue({
      version: 1,
      hostContractVersion: "test",
      compatRegistryVersion: "test",
      migrationVersion: 1,
      policyHash: "test",
      generatedAtMs: 0,
      installRecords: {},
      plugins: [],
      diagnostics: [],
    });
    resolveManifestProviderAuthChoices.mockReturnValue([]);
  });

  it("merges manifest auth-choice metadata with registry install metadata", () => {
    loadPluginRegistrySnapshot.mockReturnValue({
      version: 1,
      hostContractVersion: "test",
      compatRegistryVersion: "test",
      migrationVersion: 1,
      policyHash: "test",
      generatedAtMs: 0,
      installRecords: {},
      plugins: [
        {
          pluginId: "openai",
          origin: "bundled",
          manifestPath: "/repo/extensions/openai/opencli.plugin.json",
          manifestHash: "hash",
          rootDir: "/repo/extensions/openai",
          enabled: true,
          startup: {
            sidecar: false,
            memory: false,
            deferConfiguredChannelFullLoadUntilAfterListen: false,
            agentHarnesses: [],
          },
          compat: [],
          packageName: "@opencli/openai",
          packageInstall: {
            defaultChoice: "npm",
            npm: {
              spec: "@opencli/openai@1.2.3",
              packageName: "@opencli/openai",
              selector: "1.2.3",
              selectorKind: "exact-version",
              exactVersion: true,
              expectedIntegrity: "sha512-openai",
              pinState: "exact-with-integrity",
            },
            local: {
              path: "extensions/openai",
            },
            warnings: [],
          },
        },
      ],
      diagnostics: [],
    });
    resolveManifestProviderAuthChoices.mockReturnValue([
      {
        pluginId: "openai",
        providerId: "openai",
        methodId: "api-key",
        choiceId: "openai-api-key",
        choiceLabel: "OpenAI API key",
        groupId: "openai",
        groupLabel: "OpenAI",
      },
    ]);

    expect(resolveProviderInstallCatalogEntries()).toEqual([
      {
        pluginId: "openai",
        providerId: "openai",
        methodId: "api-key",
        choiceId: "openai-api-key",
        choiceLabel: "OpenAI API key",
        groupId: "openai",
        groupLabel: "OpenAI",
        label: "OpenAI",
        origin: "bundled",
        install: {
          npmSpec: "@opencli/openai@1.2.3",
          localPath: "extensions/openai",
          defaultChoice: "npm",
          expectedIntegrity: "sha512-openai",
        },
        installSource: {
          defaultChoice: "npm",
          npm: {
            spec: "@opencli/openai@1.2.3",
            packageName: "@opencli/openai",
            selector: "1.2.3",
            selectorKind: "exact-version",
            exactVersion: true,
            expectedIntegrity: "sha512-openai",
            pinState: "exact-with-integrity",
          },
          local: {
            path: "extensions/openai",
          },
          warnings: [],
        },
      },
    ]);
  });

  it("prefers durable install records over package-authored install intent", () => {
    loadPluginRegistrySnapshot.mockReturnValue({
      version: 1,
      hostContractVersion: "test",
      compatRegistryVersion: "test",
      migrationVersion: 1,
      policyHash: "test",
      generatedAtMs: 0,
      installRecords: {
        vllm: {
          source: "npm",
          spec: "@opencli/vllm",
          resolvedSpec: "@opencli/vllm@2.0.0",
          integrity: "sha512-vllm",
        },
      },
      plugins: [
        {
          pluginId: "vllm",
          origin: "global",
          manifestPath: "/Users/test/.opencli/plugins/vllm/opencli.plugin.json",
          manifestHash: "hash",
          rootDir: "/Users/test/.opencli/plugins/vllm",
          enabled: true,
          startup: {
            sidecar: false,
            memory: false,
            deferConfiguredChannelFullLoadUntilAfterListen: false,
            agentHarnesses: [],
          },
          compat: [],
          packageName: "@opencli/vllm",
          packageInstall: {
            npm: {
              spec: "@opencli/vllm-fork@1.0.0",
              packageName: "@opencli/vllm-fork",
              selector: "1.0.0",
              selectorKind: "exact-version",
              exactVersion: true,
              expectedIntegrity: "sha512-old",
              pinState: "exact-with-integrity",
            },
            warnings: [],
          },
        },
      ],
      diagnostics: [],
    });
    resolveManifestProviderAuthChoices.mockReturnValue([
      {
        pluginId: "vllm",
        providerId: "vllm",
        methodId: "server",
        choiceId: "vllm",
        choiceLabel: "vLLM",
        groupLabel: "vLLM",
      },
    ]);

    expect(resolveProviderInstallCatalogEntry("vllm")).toEqual({
      pluginId: "vllm",
      providerId: "vllm",
      methodId: "server",
      choiceId: "vllm",
      choiceLabel: "vLLM",
      groupLabel: "vLLM",
      label: "vLLM",
      origin: "global",
      install: {
        npmSpec: "@opencli/vllm@2.0.0",
        expectedIntegrity: "sha512-vllm",
        defaultChoice: "npm",
      },
      installSource: {
        defaultChoice: "npm",
        npm: {
          spec: "@opencli/vllm@2.0.0",
          packageName: "@opencli/vllm",
          selector: "2.0.0",
          selectorKind: "exact-version",
          exactVersion: true,
          expectedIntegrity: "sha512-vllm",
          pinState: "exact-with-integrity",
        },
        warnings: [],
      },
    });
  });

  it("does not expose untrusted global package install intent without an install record", () => {
    loadPluginRegistrySnapshot.mockReturnValue({
      version: 1,
      hostContractVersion: "test",
      compatRegistryVersion: "test",
      migrationVersion: 1,
      policyHash: "test",
      generatedAtMs: 0,
      installRecords: {},
      plugins: [
        {
          pluginId: "demo-provider",
          origin: "global",
          manifestPath: "/Users/test/.opencli/plugins/demo-provider/opencli.plugin.json",
          manifestHash: "hash",
          rootDir: "/Users/test/.opencli/plugins/demo-provider",
          enabled: true,
          startup: {
            sidecar: false,
            memory: false,
            deferConfiguredChannelFullLoadUntilAfterListen: false,
            agentHarnesses: [],
          },
          compat: [],
          packageName: "@vendor/demo-provider",
          packageInstall: {
            npm: {
              spec: "@vendor/demo-provider@1.2.3",
              packageName: "@vendor/demo-provider",
              selector: "1.2.3",
              selectorKind: "exact-version",
              exactVersion: true,
              expectedIntegrity: "sha512-demo",
              pinState: "exact-with-integrity",
            },
            warnings: [],
          },
        },
      ],
      diagnostics: [],
    });
    resolveManifestProviderAuthChoices.mockReturnValue([
      {
        pluginId: "demo-provider",
        providerId: "demo-provider",
        methodId: "api-key",
        choiceId: "demo-provider-api-key",
        choiceLabel: "Demo Provider API key",
      },
    ]);

    expect(resolveProviderInstallCatalogEntries()).toEqual([]);
  });

  it("skips untrusted workspace package install metadata when the plugin is disabled", () => {
    loadPluginRegistrySnapshot.mockReturnValue({
      version: 1,
      hostContractVersion: "test",
      compatRegistryVersion: "test",
      migrationVersion: 1,
      policyHash: "test",
      generatedAtMs: 0,
      installRecords: {},
      plugins: [
        {
          pluginId: "demo-provider",
          origin: "workspace",
          manifestPath: "/repo/extensions/demo-provider/opencli.plugin.json",
          manifestHash: "hash",
          rootDir: "/repo/extensions/demo-provider",
          enabled: false,
          startup: {
            sidecar: false,
            memory: false,
            deferConfiguredChannelFullLoadUntilAfterListen: false,
            agentHarnesses: [],
          },
          compat: [],
          packageInstall: {
            local: {
              path: "extensions/demo-provider",
            },
            warnings: [],
          },
        },
      ],
      diagnostics: [],
    });
    resolveManifestProviderAuthChoices.mockReturnValue([
      {
        pluginId: "demo-provider",
        providerId: "demo-provider",
        methodId: "api-key",
        choiceId: "demo-provider-api-key",
        choiceLabel: "Demo Provider API key",
      },
    ]);

    expect(
      resolveProviderInstallCatalogEntries({
        config: {
          plugins: {
            enabled: false,
          },
        },
        includeUntrustedWorkspacePlugins: false,
      }),
    ).toEqual([]);
  });

  it("surfaces provider-index install metadata when the provider plugin is not installed", () => {
    loadOpenCLIProviderIndex.mockReturnValue({
      version: 1,
      providers: {
        moonshot: {
          id: "moonshot",
          name: "Moonshot AI",
          plugin: {
            id: "moonshot",
            package: "@opencli/plugin-moonshot",
            install: {
              npmSpec: "@opencli/plugin-moonshot@1.2.3",
              defaultChoice: "npm",
              expectedIntegrity: "sha512-moonshot",
            },
          },
          authChoices: [
            {
              method: "api-key",
              choiceId: "moonshot-api-key",
              choiceLabel: "Moonshot API key",
              groupId: "moonshot",
              groupLabel: "Moonshot AI",
              onboardingScopes: ["text-inference"],
            },
          ],
        },
      },
    });

    expect(resolveProviderInstallCatalogEntry("moonshot-api-key")).toEqual({
      pluginId: "moonshot",
      providerId: "moonshot",
      methodId: "api-key",
      choiceId: "moonshot-api-key",
      choiceLabel: "Moonshot API key",
      groupId: "moonshot",
      groupLabel: "Moonshot AI",
      onboardingScopes: ["text-inference"],
      label: "Moonshot AI",
      origin: "bundled",
      install: {
        npmSpec: "@opencli/plugin-moonshot@1.2.3",
        defaultChoice: "npm",
        expectedIntegrity: "sha512-moonshot",
      },
      installSource: {
        defaultChoice: "npm",
        npm: {
          spec: "@opencli/plugin-moonshot@1.2.3",
          packageName: "@opencli/plugin-moonshot",
          selector: "1.2.3",
          selectorKind: "exact-version",
          exactVersion: true,
          expectedIntegrity: "sha512-moonshot",
          pinState: "exact-with-integrity",
        },
        warnings: [],
      },
    });
  });

  it("keeps provider-index entries hidden when the plugin is already installed", () => {
    loadPluginRegistrySnapshot.mockReturnValue({
      version: 1,
      hostContractVersion: "test",
      compatRegistryVersion: "test",
      migrationVersion: 1,
      policyHash: "test",
      generatedAtMs: 0,
      installRecords: {},
      plugins: [
        {
          pluginId: "moonshot",
          origin: "bundled",
          manifestPath: "/repo/extensions/moonshot/opencli.plugin.json",
          manifestHash: "hash",
          rootDir: "/repo/extensions/moonshot",
          enabled: true,
          startup: {
            sidecar: false,
            memory: false,
            deferConfiguredChannelFullLoadUntilAfterListen: false,
            agentHarnesses: [],
          },
          compat: [],
        },
      ],
      diagnostics: [],
    });
    loadOpenCLIProviderIndex.mockReturnValue({
      version: 1,
      providers: {
        moonshot: {
          id: "moonshot",
          name: "Moonshot AI",
          plugin: {
            id: "moonshot",
            package: "@opencli/plugin-moonshot",
            install: {
              npmSpec: "@opencli/plugin-moonshot@1.2.3",
              expectedIntegrity: "sha512-moonshot",
            },
          },
          authChoices: [
            {
              method: "api-key",
              choiceId: "moonshot-api-key",
              choiceLabel: "Moonshot API key",
            },
          ],
        },
      },
    });

    expect(resolveProviderInstallCatalogEntry("moonshot-api-key")).toBeUndefined();
  });
});
