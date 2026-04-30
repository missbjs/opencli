import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizeProviderModelIdWithManifest } from "./manifest-model-id-normalization.js";

const ORIGINAL_ENV = {
  OPENCLI_STATE_DIR: process.env.OPENCLI_STATE_DIR,
  OPENCLI_HOME: process.env.OPENCLI_HOME,
  OPENCLI_DISABLE_BUNDLED_PLUGINS: process.env.OPENCLI_DISABLE_BUNDLED_PLUGINS,
  OPENCLI_BUNDLED_PLUGINS_DIR: process.env.OPENCLI_BUNDLED_PLUGINS_DIR,
} as const;

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "opencli-model-id-normalization-"));
  tempDirs.push(dir);
  return dir;
}

function restoreEnv(): void {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function writeInstallIndex(params: { stateDir: string; pluginDir: string }): void {
  const indexPath = path.join(params.stateDir, "plugins", "installs.json");
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(
    indexPath,
    JSON.stringify({
      plugins: [
        {
          id: "normalizer",
          rootDir: params.pluginDir,
          origin: "global",
        },
      ],
    }),
    "utf-8",
  );
}

function writeNormalizerManifest(params: { pluginDir: string; prefix: string }): void {
  fs.mkdirSync(params.pluginDir, { recursive: true });
  fs.writeFileSync(
    path.join(params.pluginDir, "opencli.plugin.json"),
    JSON.stringify({
      id: "normalizer",
      modelIdNormalization: {
        providers: {
          demo: {
            prefixWhenBare: params.prefix,
          },
        },
      },
    }),
    "utf-8",
  );
}

function normalizeDemoModel(modelId = "demo-model"): string | undefined {
  return normalizeProviderModelIdWithManifest({
    provider: "demo",
    context: { provider: "demo", modelId },
  });
}

describe("manifest model id normalization", () => {
  afterEach(() => {
    restoreEnv();
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reflects manifest edits and state-dir changes on the next lookup", () => {
    const stateDirA = makeTempDir();
    const pluginDirA = path.join(stateDirA, "extensions", "normalizer");
    writeInstallIndex({ stateDir: stateDirA, pluginDir: pluginDirA });
    writeNormalizerManifest({ pluginDir: pluginDirA, prefix: "alpha" });

    process.env.OPENCLI_STATE_DIR = stateDirA;
    process.env.OPENCLI_HOME = undefined;
    process.env.OPENCLI_DISABLE_BUNDLED_PLUGINS = "1";
    process.env.OPENCLI_BUNDLED_PLUGINS_DIR = undefined;

    expect(normalizeDemoModel()).toBe("alpha/demo-model");

    writeNormalizerManifest({ pluginDir: pluginDirA, prefix: "bravo" });
    expect(normalizeDemoModel()).toBe("bravo/demo-model");

    const stateDirB = makeTempDir();
    const pluginDirB = path.join(stateDirB, "extensions", "normalizer");
    writeInstallIndex({ stateDir: stateDirB, pluginDir: pluginDirB });
    writeNormalizerManifest({ pluginDir: pluginDirB, prefix: "charlie" });

    process.env.OPENCLI_STATE_DIR = stateDirB;
    expect(normalizeDemoModel()).toBe("charlie/demo-model");
  });
});
