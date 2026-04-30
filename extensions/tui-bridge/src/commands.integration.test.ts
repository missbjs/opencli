import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  OpenClawPluginCommandDefinition,
  PluginCommandContext,
  PluginConversationBinding,
} from "openclaw/plugin-sdk/plugin-entry";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBindingData } from "./binding-data.js";
import { handleTuiCommand } from "./commands.js";
import { getSession, listSessions, stopSession } from "./process-pool.js";

const liveKeys = new Set<string>();
let logRoot: string;

function makeContext(
  args: string,
  overrides: Partial<PluginCommandContext> = {},
): PluginCommandContext {
  return {
    channel: "test",
    isAuthorizedSender: true,
    senderId: "user-1",
    sessionKey: `tui-test-${process.pid}-${Date.now()}`,
    args,
    commandBody: `/tui ${args}`,
    config: {},
    requestConversationBinding: async () => ({
      status: "bound",
      binding: makeBinding({}),
    }),
    detachConversationBinding: async () => ({ removed: false }),
    getCurrentConversationBinding: async () => null,
    ...overrides,
  };
}

function makeBinding(data: Record<string, unknown>): PluginConversationBinding {
  return {
    bindingId: "binding-test",
    pluginId: "tui-bridge",
    pluginRoot: "/dev/null",
    channel: "test",
    accountId: "acct",
    conversationId: "conv",
    boundAt: Date.now(),
    data,
  };
}

const baseConfig = {
  settleIdleMs: 200,
  settleMaxMs: 4000,
  cols: 80,
  rows: 24,
  defaultMode: "txt" as const,
};

function makeOptions(overrides: Record<string, unknown> = {}) {
  return { pluginConfig: { ...baseConfig, ...overrides } };
}

beforeEach(() => {
  logRoot = mkdtempSync(join(tmpdir(), "tui-bridge-cmd-"));
});

afterEach(async () => {
  for (const key of liveKeys) {
    await stopSession(key).catch(() => {});
  }
  liveKeys.clear();
  for (const s of listSessions()) {
    if (s.sessionKey.startsWith("tui-test-")) {
      await stopSession(s.sessionKey).catch(() => {});
    }
  }
  rmSync(logRoot, { recursive: true, force: true });
});

function trackSession(key: string): string {
  liveKeys.add(key);
  return key;
}

describe("handleTuiCommand integration", () => {
  it("/tui start with no args returns usage", async () => {
    const ctx = makeContext("start");
    const result = await handleTuiCommand(ctx, makeOptions());
    expect(result.text).toMatch(/Usage.*\/tui start/);
  });

  it("/tui start spawns PTY and binds conversation", async () => {
    const sessionKey = trackSession(`cmd-start-${process.pid}-${Date.now()}`);
    const ctx = makeContext("start echo hello", { sessionKey });

    const result = await handleTuiCommand(ctx, makeOptions({ logDir: logRoot }));

    expect(result.text).toMatch(/Bound this conversation/);
    expect(result.text).toMatch(/echo hello/);
    expect(getSession(sessionKey)).toBeDefined();
    expect(getSession(sessionKey)?.command).toBe("echo");
  });

  it("/tui start with disallowed command returns error", async () => {
    const sessionKey = trackSession(`cmd-deny-${process.pid}-${Date.now()}`);
    const ctx = makeContext("start rm -rf /", { sessionKey });

    const result = await handleTuiCommand(
      ctx,
      makeOptions({ allowedCommands: ["echo", "ls"], logDir: logRoot }),
    );

    expect(result.text).toMatch(/not in allowedCommands/);
    expect(getSession(sessionKey)).toBeUndefined();
  });

  it("/tui start twice on same session returns error", async () => {
    const sessionKey = trackSession(`cmd-double-${process.pid}-${Date.now()}`);
    const ctx1 = makeContext("start echo first", { sessionKey });
    const result1 = await handleTuiCommand(ctx1, makeOptions({ logDir: logRoot }));
    expect(result1.text).toMatch(/Bound/);

    const ctx2 = makeContext("start echo second", { sessionKey });
    const result2 = await handleTuiCommand(ctx2, makeOptions({ logDir: logRoot }));

    expect(result2.text).toMatch(/already bound/i);
  });

  it("/tui status shows bound TUI info", async () => {
    const sessionKey = trackSession(`cmd-status-${process.pid}-${Date.now()}`);
    const ctx1 = makeContext("start echo hello", { sessionKey });
    await handleTuiCommand(ctx1, makeOptions({ logDir: logRoot }));

    const ctx2 = makeContext("status", { sessionKey });
    const result = await handleTuiCommand(ctx2, makeOptions());

    expect(result.text).toMatch(/echo hello/);
    expect(result.text).toMatch(/mode=txt/);
  });

  it("/tui stop kills PTY and detaches binding", async () => {
    const sessionKey = trackSession(`cmd-stop-${process.pid}-${Date.now()}`);
    const ctx1 = makeContext("start echo hello", { sessionKey });
    await handleTuiCommand(ctx1, makeOptions({ logDir: logRoot }));

    const detachCalled = { value: false };
    const ctx2 = makeContext("stop", {
      sessionKey,
      detachConversationBinding: async () => {
        detachCalled.value = true;
        return { removed: true };
      },
    });
    const result = await handleTuiCommand(ctx2, makeOptions());

    expect(result.text).toMatch(/TUI stopped/);
    expect(detachCalled.value).toBe(true);
    expect(getSession(sessionKey)).toBeUndefined();
  });

  it("/tui sendln writes to stdin and returns output", async () => {
    const sessionKey = trackSession(`cmd-send-${process.pid}-${Date.now()}`);
    // Start a cat-like process that echoes stdin to stdout
    // Use quotes around the -e argument so parseArgs handles it correctly
    const nodeScript = "process.stdin.pipe(process.stdout); setInterval(() => {}, 1e9);";
    const ctx1 = makeContext(`start "${process.execPath}" -e "${nodeScript}"`, { sessionKey });
    await handleTuiCommand(ctx1, makeOptions({ logDir: logRoot }));

    // Give PTY time to initialize
    await new Promise((r) => setTimeout(r, 200));

    const ctx2 = makeContext("sendln ping-from-cmd", { sessionKey });
    const result = await handleTuiCommand(ctx2, makeOptions());

    expect(result.text).toContain("ping-from-cmd");
  });

  it("/tui help returns help text", async () => {
    const ctx = makeContext("help");
    const result = await handleTuiCommand(ctx, makeOptions());
    expect(result.text).toMatch(/TUI Bridge commands/);
    expect(result.text).toMatch(/\/tui start/);
    expect(result.text).toMatch(/\/tui stop/);
  });

  it("/tui list shows active sessions", async () => {
    const sessionKey = trackSession(`cmd-list-${process.pid}-${Date.now()}`);
    const ctx1 = makeContext("start echo hello", { sessionKey });
    await handleTuiCommand(ctx1, makeOptions({ logDir: logRoot }));

    const ctx2 = makeContext("list");
    const result = await handleTuiCommand(ctx2, makeOptions());

    expect(result.text).toMatch(/Active TUIs/);
    expect(result.text).toMatch(/echo hello/);
  });

  it("/tui mode switches output mode", async () => {
    const sessionKey = trackSession(`cmd-mode-${process.pid}-${Date.now()}`);
    const ctx1 = makeContext("start echo hello", { sessionKey });
    await handleTuiCommand(ctx1, makeOptions({ logDir: logRoot }));

    const ctx2 = makeContext("mode tui", { sessionKey });
    const result = await handleTuiCommand(ctx2, makeOptions());

    expect(result.text).toMatch(/mode set to tui/i);
    expect(getSession(sessionKey)?.mode).toBe("tui");
  });

  it("/tui restart restarts with same command", async () => {
    const sessionKey = trackSession(`cmd-restart-${process.pid}-${Date.now()}`);
    const bindingData = createBindingData({
      command: "echo",
      args: ["restarted"],
      cwd: process.cwd(),
      mode: "txt",
    });
    const ctx1 = makeContext("start echo hello", {
      sessionKey,
      getCurrentConversationBinding: async () => makeBinding(bindingData as Record<string, unknown>),
    });
    await handleTuiCommand(ctx1, makeOptions({ logDir: logRoot }));

    const ctx2 = makeContext("restart", {
      sessionKey,
      getCurrentConversationBinding: async () => makeBinding(bindingData as Record<string, unknown>),
    });
    const result = await handleTuiCommand(ctx2, makeOptions({ logDir: logRoot }));

    expect(result.text).toMatch(/Bound/);
    expect(result.text).toMatch(/echo restarted/);
    const session = getSession(sessionKey);
    expect(session).toBeDefined();
    expect(session?.command).toBe("echo");
    expect(session?.args).toContain("restarted");
  });
});
