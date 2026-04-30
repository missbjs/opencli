import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { syncPluginVersions } from "../../scripts/sync-plugin-versions.js";
import { cleanupTempDirs, makeTempDir } from "../../test/helpers/temp-dir.js";

const tempDirs: string[] = [];

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

describe("syncPluginVersions", () => {
  afterEach(() => {
    cleanupTempDirs(tempDirs);
  });

  it("preserves workspace opencli devDependencies and plugin host floors", () => {
    const rootDir = makeTempDir(tempDirs, "opencli-sync-plugin-versions-");

    writeJson(path.join(rootDir, "package.json"), {
      name: "opencli",
      version: "2026.4.1",
    });
    writeJson(path.join(rootDir, "extensions/bluebubbles/package.json"), {
      name: "@opencli/bluebubbles",
      version: "2026.3.30",
      devDependencies: {
        opencli: "workspace:*",
      },
      peerDependencies: {
        opencli: ">=2026.3.30",
      },
      opencli: {
        install: {
          minHostVersion: ">=2026.3.30",
        },
        compat: {
          pluginApi: ">=2026.3.30",
        },
        build: {
          opencliVersion: "2026.3.30",
        },
      },
    });

    const summary = syncPluginVersions(rootDir);
    const updatedPackage = JSON.parse(
      fs.readFileSync(path.join(rootDir, "extensions/bluebubbles/package.json"), "utf8"),
    ) as {
      version?: string;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      opencli?: {
        install?: {
          minHostVersion?: string;
        };
        compat?: {
          pluginApi?: string;
        };
        build?: {
          opencliVersion?: string;
        };
      };
    };

    expect(summary.updated).toContain("@opencli/bluebubbles");
    expect(updatedPackage.version).toBe("2026.4.1");
    expect(updatedPackage.devDependencies?.opencli).toBe("workspace:*");
    expect(updatedPackage.peerDependencies?.opencli).toBe(">=2026.4.1");
    expect(updatedPackage.opencli?.install?.minHostVersion).toBe(">=2026.3.30");
    expect(updatedPackage.opencli?.compat?.pluginApi).toBe(">=2026.4.1");
    expect(updatedPackage.opencli?.build?.opencliVersion).toBe("2026.4.1");
  });
});
