/**
 * Standalone MCP server for selected built-in OpenCLI tools.
 *
 * Run via: node --import tsx src/mcp/opencli-tools-serve.ts
 * Or: bun src/mcp/opencli-tools-serve.ts
 */
import { pathToFileURL } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { AnyAgentTool } from "../agents/tools/common.js";
import { createCronTool } from "../agents/tools/cron-tool.js";
import { formatErrorMessage } from "../infra/errors.js";
import { connectToolsMcpServerToStdio, createToolsMcpServer } from "./tools-stdio-server.js";

export function resolveOpenCLIToolsForMcp(): AnyAgentTool[] {
  return [createCronTool()];
}

export function createOpenCLIToolsMcpServer(
  params: {
    tools?: AnyAgentTool[];
  } = {},
): Server {
  const tools = params.tools ?? resolveOpenCLIToolsForMcp();
  return createToolsMcpServer({ name: "opencli-tools", tools });
}

export async function serveOpenCLIToolsMcp(): Promise<void> {
  const server = createOpenCLIToolsMcpServer();
  await connectToolsMcpServerToStdio(server);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  serveOpenCLIToolsMcp().catch((err) => {
    process.stderr.write(`opencli-tools-serve: ${formatErrorMessage(err)}\n`);
    process.exit(1);
  });
}
