import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnyAgentTool } from "./tools/common.js";

const mocks = vi.hoisted(() => {
  const stubTool = (name: string, ownerOnly = false) =>
    ({
      name,
      label: name,
      displaySummary: name,
      description: name,
      ownerOnly,
      parameters: { type: "object", properties: {} },
      execute: vi.fn(),
    }) satisfies AnyAgentTool;

  return {
    createOpenCLIToolsOptions: vi.fn(),
    stubTool,
  };
});

vi.mock("./opencli-tools.js", () => ({
  createOpenCLITools: (options: unknown) => {
    mocks.createOpenCLIToolsOptions(options);
    return [mocks.stubTool("cron", true)];
  },
}));

import "./test-helpers/fast-bash-tools.js";
import "./test-helpers/fast-coding-tools.js";
import { createOpenCLICodingTools } from "./pi-tools.js";

describe("createOpenCLICodingTools cron scope", () => {
  beforeEach(() => {
    mocks.createOpenCLIToolsOptions.mockClear();
  });

  it("scopes the cron owner-only runtime grant to self-removal", () => {
    const tools = createOpenCLICodingTools({
      trigger: "cron",
      jobId: "job-current",
      senderIsOwner: false,
      ownerOnlyToolAllowlist: ["cron"],
    });

    expect(tools.map((tool) => tool.name)).toContain("cron");
    expect(mocks.createOpenCLIToolsOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        cronSelfRemoveOnlyJobId: "job-current",
      }),
    );
  });

  it("does not scope ordinary owner cron sessions", () => {
    createOpenCLICodingTools({
      trigger: "cron",
      jobId: "job-current",
      senderIsOwner: true,
    });

    expect(mocks.createOpenCLIToolsOptions).toHaveBeenCalledWith(
      expect.not.objectContaining({
        cronSelfRemoveOnlyJobId: expect.any(String),
      }),
    );
  });
});
