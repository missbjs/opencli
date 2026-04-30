import { describe, expect, it } from "vitest";
import {
  isOpenCLIOwnerOnlyCoreToolName,
  OPENCLI_OWNER_ONLY_CORE_TOOL_NAMES,
} from "./tools/owner-only-tools.js";

describe("createOpenCLITools owner authorization", () => {
  it("marks owner-only core tool names", () => {
    expect(OPENCLI_OWNER_ONLY_CORE_TOOL_NAMES).toEqual(["cron", "gateway", "nodes"]);
    expect(isOpenCLIOwnerOnlyCoreToolName("cron")).toBe(true);
    expect(isOpenCLIOwnerOnlyCoreToolName("gateway")).toBe(true);
    expect(isOpenCLIOwnerOnlyCoreToolName("nodes")).toBe(true);
  });

  it("keeps canvas non-owner-only", () => {
    expect(isOpenCLIOwnerOnlyCoreToolName("canvas")).toBe(false);
  });
});
