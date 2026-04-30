import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanupTempDirs, makeTempDir } from "../test/helpers/temp-dir.js";
import {
  buildOpenCLICompileCacheRespawnPlan,
  isSourceCheckoutInstallRoot,
  resolveOpenCLICompileCacheDirectory,
  resolveEntryInstallRoot,
  shouldEnableOpenCLICompileCache,
} from "./entry.compile-cache.js";

describe("entry compile cache", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    cleanupTempDirs(tempDirs);
  });

  it("resolves install roots from source and dist entry paths", () => {
    expect(resolveEntryInstallRoot("/repo/opencli/src/entry.ts")).toBe("/repo/opencli");
    expect(resolveEntryInstallRoot("/repo/opencli/dist/entry.js")).toBe("/repo/opencli");
    expect(resolveEntryInstallRoot("/pkg/opencli/entry.js")).toBe("/pkg/opencli");
  });

  it("treats git and source entry markers as source checkouts", async () => {
    const root = makeTempDir(tempDirs, "opencli-compile-cache-source-");
    await fs.writeFile(path.join(root, ".git"), "gitdir: .git/worktrees/opencli\n", "utf8");

    expect(isSourceCheckoutInstallRoot(root)).toBe(true);
  });

  it("disables compile cache for source-checkout installs", async () => {
    const root = makeTempDir(tempDirs, "opencli-compile-cache-src-entry-");
    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.writeFile(path.join(root, "src", "entry.ts"), "export {};\n", "utf8");

    expect(
      shouldEnableOpenCLICompileCache({
        env: {},
        installRoot: root,
      }),
    ).toBe(false);
  });

  it("keeps compile cache enabled for packaged installs unless disabled by env", () => {
    const root = makeTempDir(tempDirs, "opencli-compile-cache-package-");

    expect(shouldEnableOpenCLICompileCache({ env: {}, installRoot: root })).toBe(true);
    expect(
      shouldEnableOpenCLICompileCache({
        env: { NODE_DISABLE_COMPILE_CACHE: "1" },
        installRoot: root,
      }),
    ).toBe(false);
  });

  it("scopes packaged compile cache by package install metadata", async () => {
    const root = makeTempDir(tempDirs, "opencli-compile-cache-package-key-");
    const packageJsonPath = path.join(root, "package.json");
    await fs.writeFile(packageJsonPath, '{"version":"2026.4.29"}\n', "utf8");

    const directory = resolveOpenCLICompileCacheDirectory({
      env: { NODE_COMPILE_CACHE: path.join(root, ".node-cache") },
      installRoot: root,
    });

    expect(directory).toContain(path.join(".node-cache", "opencli"));
    expect(directory).toContain("2026.4.29");
    expect(path.basename(directory)).toMatch(/^\d+-\d+$/);
  });

  it("builds a one-shot no-cache respawn plan when source checkout inherits NODE_COMPILE_CACHE", async () => {
    const root = makeTempDir(tempDirs, "opencli-compile-cache-respawn-");
    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.writeFile(path.join(root, "src", "entry.ts"), "export {};\n", "utf8");

    const plan = buildOpenCLICompileCacheRespawnPlan({
      currentFile: path.join(root, "dist", "entry.js"),
      env: { NODE_COMPILE_CACHE: "/tmp/opencli-cache" },
      execArgv: ["--no-warnings"],
      execPath: "/usr/bin/node",
      installRoot: root,
      argv: ["/usr/bin/node", path.join(root, "dist", "entry.js"), "status", "--json"],
    });

    expect(plan).toEqual({
      command: "/usr/bin/node",
      args: ["--no-warnings", path.join(root, "dist", "entry.js"), "status", "--json"],
      env: {
        NODE_DISABLE_COMPILE_CACHE: "1",
        OPENCLI_SOURCE_COMPILE_CACHE_RESPAWNED: "1",
      },
    });
  });

  it("does not respawn packaged installs when NODE_COMPILE_CACHE is configured", () => {
    const root = makeTempDir(tempDirs, "opencli-compile-cache-package-respawn-");

    expect(
      buildOpenCLICompileCacheRespawnPlan({
        currentFile: path.join(root, "dist", "entry.js"),
        env: { NODE_COMPILE_CACHE: "/tmp/opencli-cache" },
        installRoot: root,
      }),
    ).toBeUndefined();
  });

  it("does not respawn source checkouts twice", async () => {
    const root = makeTempDir(tempDirs, "opencli-compile-cache-respawn-once-");
    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.writeFile(path.join(root, "src", "entry.ts"), "export {};\n", "utf8");

    expect(
      buildOpenCLICompileCacheRespawnPlan({
        currentFile: path.join(root, "dist", "entry.js"),
        env: {
          NODE_COMPILE_CACHE: "/tmp/opencli-cache",
          OPENCLI_SOURCE_COMPILE_CACHE_RESPAWNED: "1",
        },
        installRoot: root,
      }),
    ).toBeUndefined();
  });
});
