import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatCliCommand } from "./command-format.js";
import { applyCliProfileEnv, parseCliProfileArgs } from "./profile.js";

describe("parseCliProfileArgs", () => {
  it("leaves gateway --dev for subcommands", () => {
    const res = parseCliProfileArgs([
      "node",
      "opencli",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "opencli", "gateway", "--dev", "--allow-unconfigured"]);
  });

  it("leaves gateway --dev for subcommands after leading root options", () => {
    const res = parseCliProfileArgs([
      "node",
      "opencli",
      "--no-color",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual([
      "node",
      "opencli",
      "--no-color",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
  });

  it("still accepts global --dev before subcommand", () => {
    const res = parseCliProfileArgs(["node", "opencli", "--dev", "gateway"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "opencli", "gateway"]);
  });

  it("parses --profile value and strips it", () => {
    const res = parseCliProfileArgs(["node", "opencli", "--profile", "work", "status"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "opencli", "status"]);
  });

  it("parses interleaved --profile after the command token", () => {
    const res = parseCliProfileArgs(["node", "opencli", "status", "--profile", "work", "--deep"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "opencli", "status", "--deep"]);
  });

  it("preserves Matrix QA --profile for the command parser", () => {
    const res = parseCliProfileArgs([
      "node",
      "opencli",
      "qa",
      "matrix",
      "--profile",
      "fast",
      "--fail-fast",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual([
      "node",
      "opencli",
      "qa",
      "matrix",
      "--profile",
      "fast",
      "--fail-fast",
    ]);
  });

  it("preserves Matrix QA --profile after leading root options", () => {
    const res = parseCliProfileArgs([
      "node",
      "opencli",
      "--no-color",
      "qa",
      "matrix",
      "--profile=fast",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "opencli", "--no-color", "qa", "matrix", "--profile=fast"]);
  });

  it("still parses root --profile before Matrix QA", () => {
    const res = parseCliProfileArgs([
      "node",
      "opencli",
      "--profile",
      "work",
      "qa",
      "matrix",
      "--fail-fast",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "opencli", "qa", "matrix", "--fail-fast"]);
  });

  it("parses interleaved --dev after the command token", () => {
    const res = parseCliProfileArgs(["node", "opencli", "status", "--dev"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "opencli", "status"]);
  });

  it("rejects missing profile value", () => {
    const res = parseCliProfileArgs(["node", "opencli", "--profile"]);
    expect(res.ok).toBe(false);
  });

  it.each([
    ["--dev first", ["node", "opencli", "--dev", "--profile", "work", "status"]],
    ["--profile first", ["node", "opencli", "--profile", "work", "--dev", "status"]],
    ["interleaved after command", ["node", "opencli", "status", "--profile", "work", "--dev"]],
  ])("rejects combining --dev with --profile (%s)", (_name, argv) => {
    const res = parseCliProfileArgs(argv);
    expect(res.ok).toBe(false);
  });
});

describe("applyCliProfileEnv", () => {
  it("fills env defaults for dev profile", () => {
    const env: Record<string, string | undefined> = {};
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    const expectedStateDir = path.join(path.resolve("/home/peter"), ".opencli-dev");
    expect(env.OPENCLI_PROFILE).toBe("dev");
    expect(env.OPENCLI_STATE_DIR).toBe(expectedStateDir);
    expect(env.OPENCLI_CONFIG_PATH).toBe(path.join(expectedStateDir, "opencli.json"));
    expect(env.OPENCLI_GATEWAY_PORT).toBe("19001");
  });

  it("does not override explicit env values", () => {
    const env: Record<string, string | undefined> = {
      OPENCLI_STATE_DIR: "/custom",
      OPENCLI_GATEWAY_PORT: "19099",
    };
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    expect(env.OPENCLI_STATE_DIR).toBe("/custom");
    expect(env.OPENCLI_GATEWAY_PORT).toBe("19099");
    expect(env.OPENCLI_CONFIG_PATH).toBe(path.join("/custom", "opencli.json"));
  });

  it("uses OPENCLI_HOME when deriving profile state dir", () => {
    const env: Record<string, string | undefined> = {
      OPENCLI_HOME: "/srv/opencli-home",
      HOME: "/home/other",
    };
    applyCliProfileEnv({
      profile: "work",
      env,
      homedir: () => "/home/fallback",
    });

    const resolvedHome = path.resolve("/srv/opencli-home");
    expect(env.OPENCLI_STATE_DIR).toBe(path.join(resolvedHome, ".opencli-work"));
    expect(env.OPENCLI_CONFIG_PATH).toBe(path.join(resolvedHome, ".opencli-work", "opencli.json"));
  });
});

describe("formatCliCommand", () => {
  it.each([
    {
      name: "no profile is set",
      cmd: "opencli doctor --fix",
      env: {},
      expected: "opencli doctor --fix",
    },
    {
      name: "profile is default",
      cmd: "opencli doctor --fix",
      env: { OPENCLI_PROFILE: "default" },
      expected: "opencli doctor --fix",
    },
    {
      name: "profile is Default (case-insensitive)",
      cmd: "opencli doctor --fix",
      env: { OPENCLI_PROFILE: "Default" },
      expected: "opencli doctor --fix",
    },
    {
      name: "profile is invalid",
      cmd: "opencli doctor --fix",
      env: { OPENCLI_PROFILE: "bad profile" },
      expected: "opencli doctor --fix",
    },
    {
      name: "--profile is already present",
      cmd: "opencli --profile work doctor --fix",
      env: { OPENCLI_PROFILE: "work" },
      expected: "opencli --profile work doctor --fix",
    },
    {
      name: "--dev is already present",
      cmd: "opencli --dev doctor",
      env: { OPENCLI_PROFILE: "dev" },
      expected: "opencli --dev doctor",
    },
  ])("returns command unchanged when $name", ({ cmd, env, expected }) => {
    expect(formatCliCommand(cmd, env)).toBe(expected);
  });

  it("inserts --profile flag when profile is set", () => {
    expect(formatCliCommand("opencli doctor --fix", { OPENCLI_PROFILE: "work" })).toBe(
      "opencli --profile work doctor --fix",
    );
  });

  it("trims whitespace from profile", () => {
    expect(formatCliCommand("opencli doctor --fix", { OPENCLI_PROFILE: "  jbopencli  " })).toBe(
      "opencli --profile jbopencli doctor --fix",
    );
  });

  it("handles command with no args after opencli", () => {
    expect(formatCliCommand("opencli", { OPENCLI_PROFILE: "test" })).toBe("opencli --profile test");
  });

  it("handles pnpm wrapper", () => {
    expect(formatCliCommand("pnpm opencli doctor", { OPENCLI_PROFILE: "work" })).toBe(
      "pnpm opencli --profile work doctor",
    );
  });

  it("inserts --container when a container hint is set", () => {
    expect(
      formatCliCommand("opencli gateway status --deep", { OPENCLI_CONTAINER_HINT: "demo" }),
    ).toBe("opencli --container demo gateway status --deep");
  });

  it("ignores unsafe container hints", () => {
    expect(
      formatCliCommand("opencli gateway status --deep", {
        OPENCLI_CONTAINER_HINT: "demo; rm -rf /",
      }),
    ).toBe("opencli gateway status --deep");
  });

  it("preserves both --container and --profile hints", () => {
    expect(
      formatCliCommand("opencli doctor", {
        OPENCLI_CONTAINER_HINT: "demo",
        OPENCLI_PROFILE: "work",
      }),
    ).toBe("opencli --container demo doctor");
  });

  it("does not prepend --container for update commands", () => {
    expect(formatCliCommand("opencli update", { OPENCLI_CONTAINER_HINT: "demo" })).toBe(
      "opencli update",
    );
    expect(
      formatCliCommand("pnpm opencli update --channel beta", { OPENCLI_CONTAINER_HINT: "demo" }),
    ).toBe("pnpm opencli update --channel beta");
  });
});
