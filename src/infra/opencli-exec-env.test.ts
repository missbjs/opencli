import { describe, expect, it } from "vitest";
import {
  ensureOpenCLIExecMarkerOnProcess,
  markOpenCLIExecEnv,
  OPENCLI_CLI_ENV_VALUE,
  OPENCLI_CLI_ENV_VAR,
} from "./opencli-exec-env.js";

describe("markOpenCLIExecEnv", () => {
  it("returns a cloned env object with the exec marker set", () => {
    const env = { PATH: "/usr/bin", OPENCLI_CLI: "0" };
    const marked = markOpenCLIExecEnv(env);

    expect(marked).toEqual({
      PATH: "/usr/bin",
      OPENCLI_CLI: OPENCLI_CLI_ENV_VALUE,
    });
    expect(marked).not.toBe(env);
    expect(env.OPENCLI_CLI).toBe("0");
  });
});

describe("ensureOpenCLIExecMarkerOnProcess", () => {
  it.each([
    {
      name: "mutates and returns the provided process env",
      env: { PATH: "/usr/bin" } as NodeJS.ProcessEnv,
    },
    {
      name: "overwrites an existing marker on the provided process env",
      env: { PATH: "/usr/bin", [OPENCLI_CLI_ENV_VAR]: "0" } as NodeJS.ProcessEnv,
    },
  ])("$name", ({ env }) => {
    expect(ensureOpenCLIExecMarkerOnProcess(env)).toBe(env);
    expect(env[OPENCLI_CLI_ENV_VAR]).toBe(OPENCLI_CLI_ENV_VALUE);
  });

  it("defaults to mutating process.env when no env object is provided", () => {
    const previous = process.env[OPENCLI_CLI_ENV_VAR];
    delete process.env[OPENCLI_CLI_ENV_VAR];

    try {
      expect(ensureOpenCLIExecMarkerOnProcess()).toBe(process.env);
      expect(process.env[OPENCLI_CLI_ENV_VAR]).toBe(OPENCLI_CLI_ENV_VALUE);
    } finally {
      if (previous === undefined) {
        delete process.env[OPENCLI_CLI_ENV_VAR];
      } else {
        process.env[OPENCLI_CLI_ENV_VAR] = previous;
      }
    }
  });
});
