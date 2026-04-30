import { describe, expect, it } from "vitest";
import { resolveOpenCLIToolsForMcp } from "./opencli-tools-serve.js";
import { createPluginToolsMcpHandlers } from "./plugin-tools-handlers.js";

describe("OpenCLI tools MCP server", () => {
  it("does not expose owner-only cron", async () => {
    const handlers = createPluginToolsMcpHandlers(resolveOpenCLIToolsForMcp());

    const listed = await handlers.listTools();
    expect(listed.tools.map((tool) => tool.name)).not.toContain("cron");
  });

  it("blocks owner-only cron invocation", async () => {
    const handlers = createPluginToolsMcpHandlers(resolveOpenCLIToolsForMcp());

    const result = await handlers.callTool({ name: "cron", arguments: { action: "status" } });
    expect(result).toEqual({
      content: [{ type: "text", text: "Unknown tool: cron" }],
      isError: true,
    });
  });
});
