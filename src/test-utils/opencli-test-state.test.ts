import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createOpenCLITestState, withOpenCLITestState } from "./opencli-test-state.js";

describe("opencli test state", () => {
  it("creates an isolated home layout with spawn env and restores process env", async () => {
    const previousHome = process.env.HOME;
    const previousOpenCLIHome = process.env.OPENCLI_HOME;
    const previousStateDir = process.env.OPENCLI_STATE_DIR;
    const previousConfigPath = process.env.OPENCLI_CONFIG_PATH;

    const state = await createOpenCLITestState({
      label: "unit",
      scenario: "minimal",
    });

    try {
      expect(state.home).toBe(path.join(state.root, "home"));
      expect(state.stateDir).toBe(path.join(state.home, ".opencli"));
      expect(state.configPath).toBe(path.join(state.stateDir, "opencli.json"));
      expect(state.workspaceDir).toBe(path.join(state.home, "workspace"));
      expect(state.env.HOME).toBe(state.home);
      expect(state.env.OPENCLI_HOME).toBe(state.home);
      expect(state.env.OPENCLI_STATE_DIR).toBe(state.stateDir);
      expect(state.env.OPENCLI_CONFIG_PATH).toBe(state.configPath);
      expect(process.env.HOME).toBe(state.home);
      expect(process.env.OPENCLI_HOME).toBe(state.home);
      expect(JSON.parse(await fs.readFile(state.configPath, "utf8"))).toEqual({});
    } finally {
      await state.cleanup();
    }

    expect(process.env.HOME).toBe(previousHome);
    expect(process.env.OPENCLI_HOME).toBe(previousOpenCLIHome);
    expect(process.env.OPENCLI_STATE_DIR).toBe(previousStateDir);
    expect(process.env.OPENCLI_CONFIG_PATH).toBe(previousConfigPath);
    await expect(fs.stat(state.root)).rejects.toThrow();
  });

  it("supports state-only layout without overriding HOME", async () => {
    const previousHome = process.env.HOME;

    await withOpenCLITestState(
      {
        layout: "state-only",
        scenario: "empty",
      },
      async (state) => {
        expect(process.env.HOME).toBe(previousHome);
        expect(process.env.OPENCLI_STATE_DIR).toBe(state.stateDir);
        expect(process.env.OPENCLI_CONFIG_PATH).toBe(state.configPath);
        expect(state.env.HOME).toBe(previousHome);
        await expect(fs.stat(state.configPath)).rejects.toThrow();
      },
    );
  });

  it("clears inherited agent-dir overrides by default", async () => {
    const previousAgentDir = process.env.OPENCLI_AGENT_DIR;
    const previousPiAgentDir = process.env.PI_CODING_AGENT_DIR;
    process.env.OPENCLI_AGENT_DIR = "/tmp/outside-opencli-agent";
    process.env.PI_CODING_AGENT_DIR = "/tmp/outside-pi-agent";

    try {
      const state = await createOpenCLITestState({
        layout: "state-only",
      });

      try {
        expect(process.env.OPENCLI_AGENT_DIR).toBeUndefined();
        expect(process.env.PI_CODING_AGENT_DIR).toBeUndefined();
        expect(state.env.OPENCLI_AGENT_DIR).toBeUndefined();
        expect(state.env.PI_CODING_AGENT_DIR).toBeUndefined();
        expect(state.agentDir()).toBe(path.join(state.stateDir, "agents", "main", "agent"));
      } finally {
        await state.cleanup();
      }

      expect(process.env.OPENCLI_AGENT_DIR).toBe("/tmp/outside-opencli-agent");
      expect(process.env.PI_CODING_AGENT_DIR).toBe("/tmp/outside-pi-agent");
    } finally {
      if (previousAgentDir === undefined) {
        delete process.env.OPENCLI_AGENT_DIR;
      } else {
        process.env.OPENCLI_AGENT_DIR = previousAgentDir;
      }
      if (previousPiAgentDir === undefined) {
        delete process.env.PI_CODING_AGENT_DIR;
      } else {
        process.env.PI_CODING_AGENT_DIR = previousPiAgentDir;
      }
    }
  });

  it("allows explicit agent-dir overrides when a test needs them", async () => {
    await withOpenCLITestState(
      {
        env: {
          OPENCLI_AGENT_DIR: "/tmp/explicit-opencli-agent",
          PI_CODING_AGENT_DIR: "/tmp/explicit-pi-agent",
        },
      },
      async (state) => {
        expect(process.env.OPENCLI_AGENT_DIR).toBe("/tmp/explicit-opencli-agent");
        expect(process.env.PI_CODING_AGENT_DIR).toBe("/tmp/explicit-pi-agent");
        expect(state.env.OPENCLI_AGENT_DIR).toBe("/tmp/explicit-opencli-agent");
        expect(state.env.PI_CODING_AGENT_DIR).toBe("/tmp/explicit-pi-agent");
      },
    );
  });

  it("can route agent-dir env vars to the isolated main agent store", async () => {
    await withOpenCLITestState(
      {
        agentEnv: "main",
      },
      async (state) => {
        expect(process.env.OPENCLI_AGENT_DIR).toBe(state.agentDir());
        expect(process.env.PI_CODING_AGENT_DIR).toBe(state.agentDir());
        expect(state.env.OPENCLI_AGENT_DIR).toBe(state.agentDir());
        expect(state.env.PI_CODING_AGENT_DIR).toBe(state.agentDir());
      },
    );
  });

  it("writes scenario configs and auth profile stores", async () => {
    await withOpenCLITestState(
      {
        scenario: "update-stable",
      },
      async (state) => {
        expect(JSON.parse(await fs.readFile(state.configPath, "utf8"))).toEqual({
          update: {
            channel: "stable",
          },
          plugins: {},
        });

        const profilePath = await state.writeAuthProfiles({
          version: 1,
          profiles: {
            "openai:test": {
              type: "api_key",
              provider: "openai",
              key: "sk-test",
            },
          },
        });

        expect(profilePath).toBe(path.join(state.agentDir(), "auth-profiles.json"));
        expect(JSON.parse(await fs.readFile(profilePath, "utf8"))).toMatchObject({
          version: 1,
          profiles: {
            "openai:test": {
              provider: "openai",
            },
          },
        });
      },
    );
  });

  it("keeps external-service env scoped to the fixture", async () => {
    const previousPolicy = process.env.OPENCLI_SERVICE_REPAIR_POLICY;

    await withOpenCLITestState(
      {
        scenario: "external-service",
      },
      async (state) => {
        expect(process.env.OPENCLI_SERVICE_REPAIR_POLICY).toBe("external");
        expect(state.env.OPENCLI_SERVICE_REPAIR_POLICY).toBe("external");
      },
    );

    expect(process.env.OPENCLI_SERVICE_REPAIR_POLICY).toBe(previousPolicy);
  });
});
