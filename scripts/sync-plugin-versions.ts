import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

type PackageJson = {
  name?: string;
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

const OPENCLI_VERSION_RANGE_RE = /^>=\d{4}\.\d{1,2}\.\d{1,2}(?:[-.][^"\s]+)?$/u;

function syncOpenCLIDependencyRange(
  deps: Record<string, string> | undefined,
  targetVersion: string,
): boolean {
  const current = deps?.opencli;
  if (!current || current === "workspace:*" || !OPENCLI_VERSION_RANGE_RE.test(current)) {
    return false;
  }
  const next = `>=${targetVersion}`;
  if (current === next) {
    return false;
  }
  deps.opencli = next;
  return true;
}

function syncPluginApiVersion(pkg: PackageJson, targetVersion: string): boolean {
  const compat = pkg.opencli?.compat;
  const current = compat?.pluginApi;
  if (!current || !OPENCLI_VERSION_RANGE_RE.test(current)) {
    return false;
  }
  const next = `>=${targetVersion}`;
  if (current === next) {
    return false;
  }
  compat.pluginApi = next;
  return true;
}

function syncBuildOpenCLIVersion(pkg: PackageJson, targetVersion: string): boolean {
  const build = pkg.opencli?.build;
  const current = build?.opencliVersion;
  if (!current) {
    return false;
  }
  if (current === targetVersion) {
    return false;
  }
  build.opencliVersion = targetVersion;
  return true;
}

function ensureChangelogEntry(changelogPath: string, version: string): boolean {
  if (!existsSync(changelogPath)) {
    return false;
  }
  const content = readFileSync(changelogPath, "utf8");
  if (content.includes(`## ${version}`)) {
    return false;
  }
  const entry = `## ${version}\n\n### Changes\n- Version alignment with core OpenCLI release numbers.\n\n`;
  if (content.startsWith("# Changelog\n\n")) {
    const next = content.replace("# Changelog\n\n", `# Changelog\n\n${entry}`);
    writeFileSync(changelogPath, next);
    return true;
  }
  const next = `# Changelog\n\n${entry}${content.trimStart()}`;
  writeFileSync(changelogPath, `${next}\n`);
  return true;
}

export function syncPluginVersions(rootDir = resolve(".")) {
  const rootPackagePath = join(rootDir, "package.json");
  const rootPackage = JSON.parse(readFileSync(rootPackagePath, "utf8")) as PackageJson;
  const targetVersion = rootPackage.version;
  if (!targetVersion) {
    throw new Error("Root package.json missing version.");
  }

  const extensionsDir = join(rootDir, "extensions");
  const dirs = readdirSync(extensionsDir, { withFileTypes: true }).filter((entry) =>
    entry.isDirectory(),
  );

  const updated: string[] = [];
  const changelogged: string[] = [];
  const skipped: string[] = [];

  for (const dir of dirs) {
    const packagePath = join(extensionsDir, dir.name, "package.json");
    let pkg: PackageJson;
    try {
      pkg = JSON.parse(readFileSync(packagePath, "utf8")) as PackageJson;
    } catch {
      continue;
    }

    if (!pkg.name) {
      skipped.push(dir.name);
      continue;
    }

    const changelogPath = join(extensionsDir, dir.name, "CHANGELOG.md");
    if (ensureChangelogEntry(changelogPath, targetVersion)) {
      changelogged.push(pkg.name);
    }

    const versionChanged = pkg.version !== targetVersion;
    const devDependencyChanged = syncOpenCLIDependencyRange(pkg.devDependencies, targetVersion);
    const peerDependencyChanged = syncOpenCLIDependencyRange(pkg.peerDependencies, targetVersion);
    // minHostVersion is a compatibility floor, not release alignment metadata.
    // Keep it stable unless the owning plugin intentionally raises it.
    const pluginApiChanged = syncPluginApiVersion(pkg, targetVersion);
    const buildOpenCLIVersionChanged = syncBuildOpenCLIVersion(pkg, targetVersion);
    const packageChanged =
      versionChanged ||
      devDependencyChanged ||
      peerDependencyChanged ||
      pluginApiChanged ||
      buildOpenCLIVersionChanged;
    if (!packageChanged) {
      skipped.push(pkg.name);
      continue;
    }

    if (versionChanged) {
      pkg.version = targetVersion;
    }
    writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
    updated.push(pkg.name);
  }

  return {
    targetVersion,
    updated,
    changelogged,
    skipped,
  };
}

if (import.meta.main) {
  const summary = syncPluginVersions();
  console.log(
    `Synced plugin versions to ${summary.targetVersion}. Updated: ${summary.updated.length}. Changelogged: ${summary.changelogged.length}. Skipped: ${summary.skipped.length}.`,
  );
}
