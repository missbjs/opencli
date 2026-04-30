import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  PluginHookInboundClaimContext,
  PluginHookInboundClaimEvent,
} from "openclaw/plugin-sdk/plugin-entry";
import type { PluginConversationBinding } from "openclaw/plugin-sdk/plugin-entry";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBindingData } from "./binding-data.js";
import { handleTuiInboundClaim } from "./inbound-claim.js";
import { getSession, startSession, stopSession } from "./process-pool.js";

const liveKeys = new Set<string>();
let logRoot: string;

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

function makeEvent(over: Partial<PluginHookInboundClaimEvent> = {}): PluginHookInboundClaimEvent {
  return {
    content: "",
    channel: "test",
    isGroup: false,
    commandAuthorized: true,
    ...over,
  };
}

const cfg = { settleIdleMs: 200, settleMaxMs: 4000, cols: 80, rows: 24, defaultMode: "txt" };

beforeEach(() => {
  logRoot = mkdtempSync(join(tmpdir(), "tui-bridge-claim-"));
});

afterEach(async () => {
  for (const k of liveKeys) await stopSession(k);
  liveKeys.clear();
  rmSync(logRoot, { recursive: true, force: true });
});

describe("handleTuiInboundClaim", () => {
  it("returns undefined when there is no plugin binding", async () => {
    const result = await handleTuiInboundClaim(
      makeEvent({ bodyForAgent: "anything" }),
      { sessionKey: "k1" } as PluginHookInboundClaimContext,
      { pluginConfig: cfg },
    );
    expect(result).toBeUndefined();
  });

  it("returns handled with no reply when commandAuthorized is not true", async () => {
    const data = createBindingData({
      command: "echo",
      args: ["x"],
      cwd: process.cwd(),
      mode: "txt",
    });
    const ctx = {
      sessionKey: "k2",
      pluginBinding: makeBinding(data as unknown as Record<string, unknown>),
    } as PluginHookInboundClaimContext;
    const result = await handleTuiInboundClaim(
      makeEvent({ bodyForAgent: "hi", commandAuthorized: false }),
      ctx,
      { pluginConfig: cfg },
    );
    expect(result).toEqual({ handled: true });
  });

  it("returns an explanatory reply when no sessionKey is available", async () => {
    const data = createBindingData({ command: "echo", args: [], cwd: process.cwd(), mode: "txt" });
    const ctx = {
      pluginBinding: makeBinding(data as unknown as Record<string, unknown>),
    } as PluginHookInboundClaimContext;
    const result = await handleTuiInboundClaim(makeEvent({ bodyForAgent: "hi" }), ctx, {
      pluginConfig: cfg,
    });
    expect(result?.handled).toBe(true);
    expect(result?.reply?.text).toMatch(/no sessionKey/i);
  });

  it("writes to an existing session and returns the PTY output", async () => {
    const sessionKey = `claim-happy-${process.pid}-${Date.now()}`;
    liveKeys.add(sessionKey);
    await startSession({
      sessionKey,
      command: "/usr/bin/cat",
      args: [],
      cwd: process.cwd(),
      mode: "txt",
      cols: 80,
      rows: 24,
      logRoot,
    });
    const data = createBindingData({
      command: "/usr/bin/cat",
      args: [],
      cwd: process.cwd(),
      mode: "txt",
    });
    const ctx = {
      sessionKey,
      pluginBinding: makeBinding(data as unknown as Record<string, unknown>),
    } as PluginHookInboundClaimContext;

    const result = await handleTuiInboundClaim(
      makeEvent({ bodyForAgent: "ping-from-claim" }),
      ctx,
      { pluginConfig: cfg },
    );

    expect(result?.handled).toBe(true);
    expect(result?.reply?.text ?? "").toContain("ping-from-claim");
    expect(getSession(sessionKey)).toBeDefined();
  });

  it("respawns from binding data when no session exists yet", async () => {
    const sessionKey = `claim-respawn-${process.pid}-${Date.now()}`;
    liveKeys.add(sessionKey);
    expect(getSession(sessionKey)).toBeUndefined();

    const data = createBindingData({
      command: "/usr/bin/cat",
      args: [],
      cwd: process.cwd(),
      mode: "txt",
    });
    const ctx = {
      sessionKey,
      pluginBinding: makeBinding(data as unknown as Record<string, unknown>),
    } as PluginHookInboundClaimContext;

    const result = await handleTuiInboundClaim(makeEvent({ bodyForAgent: "respawn-hello" }), ctx, {
      pluginConfig: { ...cfg, logDir: logRoot },
    });

    expect(result?.handled).toBe(true);
    expect(result?.reply?.text ?? "").toContain("respawn-hello");
    expect(getSession(sessionKey)).toBeDefined();
  });

  it("reports exit code when the bound process has already exited", async () => {
    const sessionKey = `claim-exit-${process.pid}-${Date.now()}`;
    liveKeys.add(sessionKey);
    const session = await startSession({
      sessionKey,
      command: "/bin/sh",
      args: ["-c", "exit 0"],
      cwd: process.cwd(),
      mode: "txt",
      cols: 80,
      rows: 24,
      logRoot,
    });
    await new Promise<void>((resolve) => {
      const tick = () => (session.exitInfo ? resolve() : setTimeout(tick, 25));
      tick();
    });

    const data = createBindingData({
      command: "/bin/sh",
      args: ["-c", "exit 0"],
      cwd: process.cwd(),
      mode: "txt",
    });
    const ctx = {
      sessionKey,
      pluginBinding: makeBinding(data as unknown as Record<string, unknown>),
    } as PluginHookInboundClaimContext;

    const result = await handleTuiInboundClaim(makeEvent({ bodyForAgent: "after-exit" }), ctx, {
      pluginConfig: cfg,
    });

    expect(result?.handled).toBe(true);
    expect(result?.reply?.text ?? "").toMatch(/TUI exited/i);
  });
});
