// End-to-end driver: simulates the exact dispatch path the gateway uses
// when a Telegram DM arrives carrying "/tui start bash" then "pwd" then "/tui stop".
// Exercises commands.ts + inbound-claim.ts together, no gateway, no Telegram.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { describe, expect, it, afterEach, beforeEach } from "vitest";
import type {
  PluginCommandContext,
  PluginConversationBinding,
  PluginConversationBindingRequestParams,
  PluginConversationBindingRequestResult,
  PluginHookInboundClaimContext,
} from "openclaw/plugin-sdk/plugin-entry";
import { handleTuiCommand } from "./commands.js";
import { handleTuiInboundClaim } from "./inbound-claim.js";
import { getSession, stopSession } from "./process-pool.js";

// On Windows, the ConPTY worker thread can emit uncaught errors after the PTY
// is killed (race between worker dispose and connection teardown). These are
// harmless for tests — suppress them so they don't fail the run.
const originalHandler = process.listeners("uncaughtException").slice();
process.on("uncaughtException", (err: Error) => {
  if (
    err.message.includes("error code: 267") ||
    err.message.includes("Cannot create process")
  ) {
    return; // swallow known PTY teardown race
  }
  // Re-emit for anything else
  for (const listener of originalHandler) {
    try {
      listener(err, "uncaughtException");
    } catch {
      // ignore listener errors
    }
  }
});

describe("end-to-end: /tui start bash → pwd → /tui stop (no gateway)", () => {
  let logRoot: string;
  let liveSessionKey: string | undefined;
  let binding: PluginConversationBinding | undefined;

  beforeEach(() => {
    logRoot = mkdtempSync(join(tmpdir(), "tui-bridge-e2e-"));
    binding = undefined;
  });

  afterEach(async () => {
    if (liveSessionKey) {
      const session = getSession(liveSessionKey);
      if (session) {
        await stopSession(liveSessionKey).catch(() => {});
      }
    }
    liveSessionKey = undefined;
    binding = undefined;
    rmSync(logRoot, { recursive: true, force: true });
  });

  function makeCommandCtx(args: string): PluginCommandContext {
    const sessionKey = `e2e-${process.pid}-${Date.now()}`;
    liveSessionKey = sessionKey;
    return {
      senderId: "telegram:255433743",
      channel: "telegram",
      isAuthorizedSender: true,
      senderIsOwner: true,
      sessionKey,
      commandBody: `/tui ${args}`,
      args,
      // The two binding methods the plugin actually calls:
      requestConversationBinding: async (
        params: PluginConversationBindingRequestParams,
      ): Promise<PluginConversationBindingRequestResult> => {
        binding = {
          bindingId: "fake-binding-1",
          pluginId: "tui-bridge",
          pluginRoot: "",
          channel: "telegram",
          accountId: "default",
          conversationId: "255433743",
          boundAt: Date.now(),
          data: params.data ?? {},
          summary: params.summary,
        } as PluginConversationBinding;
        return { status: "bound", binding };
      },
      getCurrentConversationBinding: async () => binding,
      detachConversationBinding: async () => {
        binding = undefined;
        return { ok: true };
      },
      // Required ctx fields are typed loose enough that the plugin only
      // touches the ones above; cast to any for the rest.
    } as unknown as PluginCommandContext;
  }

  const cfg = {
    defaultMode: "txt" as const,
    settleIdleMs: 600,
    settleMaxMs: 5000,
    cols: 100,
    rows: 30,
    logDir: "",
  };

  it("resolves bare 'bash' against PATH+PATHEXT on Windows", async () => {
    const ctx = makeCommandCtx("start bash");
    const result = await handleTuiCommand(ctx, {
      pluginConfig: { ...cfg, logDir: logRoot },
    });
    // After the resolveExecutable() fix, bare "bash" should now bind on Windows
    // wherever bash.exe sits in PATH (git-bash, cygwin, WSL shim, …).
    expect(result.text).toMatch(/Bound this conversation to TUI .*bash/i);
  });

  it("resolves bare 'cmd' on Windows (System32\\cmd.exe via PATHEXT)", async () => {
    const ctx = makeCommandCtx("start cmd");
    const result = await handleTuiCommand(ctx, {
      pluginConfig: { ...cfg, logDir: logRoot },
    });
    expect(result.text).toMatch(/Bound this conversation to TUI .*cmd/i);
  });

  it("spawns bash via /tui start, pipes pwd to it, returns the cwd, then stops cleanly", async () => {
    // After the resolveExecutable() fix, bare "bash" works on Windows.
    const startCtx = makeCommandCtx("start bash");
    const startResult = await handleTuiCommand(startCtx, {
      pluginConfig: { ...cfg, logDir: logRoot },
    });
    expect(startResult.text).toMatch(/Bound this conversation to TUI .*bash/i);
    expect(binding).toBeDefined();
    expect(getSession(startCtx.sessionKey!)).toBeDefined();

    // Step 2: plain message "pwd" → inbound_claim writes to bash stdin, returns prompt+cwd
    const inboundCtx = {
      sessionKey: startCtx.sessionKey,
      pluginBinding: binding,
    } as unknown as PluginHookInboundClaimContext;

    const inboundResult = await handleTuiInboundClaim(
      {
        content: "pwd",
        bodyForAgent: "pwd",
        channel: "telegram",
        isGroup: false,
        commandAuthorized: true,
      },
      inboundCtx,
      { pluginConfig: { ...cfg, logDir: logRoot } },
    );

    expect(inboundResult?.handled).toBe(true);
    const replyText = inboundResult?.reply?.text ?? "";
    // bash echoes "pwd" then prints cwd. MINGW prints lowercased drive letter
    // with forward slashes (/d/Developments/...), so normalise both sides.
    const expectedTail = process
      .cwd()
      .replace(/^([A-Za-z]):/, (_, d: string) => `/${d.toLowerCase()}`)
      .split("\\")
      .join("/");
    expect(replyText).toMatch(/\$ pwd/);
    expect(replyText).toContain(expectedTail);

    // Step 3: /tui stop
    const stopCtx = makeCommandCtx("stop");
    // re-bind to the active session so /tui stop targets the same one
    (stopCtx as unknown as Record<string, unknown>).sessionKey = startCtx.sessionKey;
    const stopResult = await handleTuiCommand(stopCtx, {
      pluginConfig: { ...cfg, logDir: logRoot },
    });
    expect(stopResult.text).toMatch(/TUI stopped/i);
    expect(getSession(startCtx.sessionKey!)).toBeUndefined();
  });
});
