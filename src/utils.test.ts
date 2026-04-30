import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { withTempDir } from "./test-helpers/temp-dir.js";
import {
  ensureDir,
  resolveConfigDir,
  resolveHomeDir,
  resolveUserPath,
  shortenHomeInString,
  shortenHomePath,
  sleep,
} from "./utils.js";

describe("ensureDir", () => {
  it("creates nested directory", async () => {
    await withTempDir({ prefix: "opencli-test-" }, async (tmp) => {
      const target = path.join(tmp, "nested", "dir");
      await ensureDir(target);
      expect(fs.existsSync(target)).toBe(true);
    });
  });
});

describe("sleep", () => {
  it("resolves after delay using fake timers", async () => {
    vi.useFakeTimers();
    try {
      const promise = sleep(1000);
      vi.advanceTimersByTime(1000);
      await expect(promise).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("resolveConfigDir", () => {
  it("prefers ~/.opencli when legacy dir is missing", async () => {
    await withTempDir({ prefix: "opencli-config-dir-" }, async (root) => {
      const newDir = path.join(root, ".opencli");
      await fs.promises.mkdir(newDir, { recursive: true });
      const resolved = resolveConfigDir({} as NodeJS.ProcessEnv, () => root);
      expect(resolved).toBe(newDir);
    });
  });

  it("expands OPENCLI_STATE_DIR using the provided env", () => {
    const env = {
      HOME: "/tmp/opencli-home",
      OPENCLI_STATE_DIR: "~/state",
    } as NodeJS.ProcessEnv;

    expect(resolveConfigDir(env)).toBe(path.resolve("/tmp/opencli-home", "state"));
  });

  it("falls back to the config file directory when only OPENCLI_CONFIG_PATH is set", () => {
    const env = {
      HOME: "/tmp/opencli-home",
      OPENCLI_CONFIG_PATH: "~/profiles/dev/opencli.json",
    } as NodeJS.ProcessEnv;

    expect(resolveConfigDir(env)).toBe(path.resolve("/tmp/opencli-home", "profiles", "dev"));
  });
});

describe("resolveHomeDir", () => {
  it("prefers OPENCLI_HOME over HOME", () => {
    vi.stubEnv("OPENCLI_HOME", "/srv/opencli-home");
    vi.stubEnv("HOME", "/home/other");
    try {
      expect(resolveHomeDir()).toBe(path.resolve("/srv/opencli-home"));
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("shortenHomePath", () => {
  it("uses $OPENCLI_HOME prefix when OPENCLI_HOME is set", () => {
    vi.stubEnv("OPENCLI_HOME", "/srv/opencli-home");
    vi.stubEnv("HOME", "/home/other");
    try {
      expect(shortenHomePath(`${path.resolve("/srv/opencli-home")}/.opencli/opencli.json`)).toBe(
        "$OPENCLI_HOME/.opencli/opencli.json",
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("shortenHomeInString", () => {
  it("uses $OPENCLI_HOME replacement when OPENCLI_HOME is set", () => {
    vi.stubEnv("OPENCLI_HOME", "/srv/opencli-home");
    vi.stubEnv("HOME", "/home/other");
    try {
      expect(
        shortenHomeInString(`config: ${path.resolve("/srv/opencli-home")}/.opencli/opencli.json`),
      ).toBe("config: $OPENCLI_HOME/.opencli/opencli.json");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("resolveUserPath", () => {
  it("expands ~ to home dir", () => {
    expect(resolveUserPath("~", {}, () => "/Users/thoffman")).toBe(path.resolve("/Users/thoffman"));
  });

  it("expands ~/ to home dir", () => {
    expect(resolveUserPath("~/opencli", {}, () => "/Users/thoffman")).toBe(
      path.resolve("/Users/thoffman", "opencli"),
    );
  });

  it("resolves relative paths", () => {
    expect(resolveUserPath("tmp/dir")).toBe(path.resolve("tmp/dir"));
  });

  it("prefers OPENCLI_HOME for tilde expansion", () => {
    vi.stubEnv("OPENCLI_HOME", "/srv/opencli-home");
    vi.stubEnv("HOME", "/home/other");
    try {
      expect(resolveUserPath("~/opencli")).toBe(path.resolve("/srv/opencli-home", "opencli"));
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("uses the provided env for tilde expansion", () => {
    const env = {
      HOME: "/tmp/opencli-home",
      OPENCLI_HOME: "/srv/opencli-home",
    } as NodeJS.ProcessEnv;

    expect(resolveUserPath("~/opencli", env)).toBe(path.resolve("/srv/opencli-home", "opencli"));
  });

  it("keeps blank paths blank", () => {
    expect(resolveUserPath("")).toBe("");
    expect(resolveUserPath("   ")).toBe("");
  });

  it("returns empty string for undefined/null input", () => {
    expect(resolveUserPath(undefined as unknown as string)).toBe("");
    expect(resolveUserPath(null as unknown as string)).toBe("");
  });
});
