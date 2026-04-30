// Comprehensive tui-bridge plugin behavior coverage:
// - resolveExecutable() unit cases (Windows + non-Windows behavior)
// - slash command flows: help, list, status, mode, peek, send, sendln, restart, stop
// - inbound_claim flows: bound/unbound/unauthorized/no-session
// - allowedCommands gating
// - multi-step interaction round-trips through bash

import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  PluginCommandContext,
  PluginConversationBinding,
  PluginConversationBindingRequestParams,
  PluginConversationBindingRequestResult,
  PluginHookInboundClaimContext,
} from "openclaw/plugin-sdk/plugin-entry";
import { handleTuiCommand } from "./commands.js";
import { handleTuiInboundClaim } from "./inbound-claim.js";
import {
  getSession,
  listSessions,
  resolveExecutable,
  stopSession,
} from "./process-pool.js";

const isWindows = process.platform === "win32";

describe("resolveExecutable()", () => {
  it("returns input unchanged on non-Windows", () => {
    if (isWindows) return; // skip
    expect(resolveExecutable("ls")).toBe("ls");
    expect(resolveExecutable("/usr/bin/cat")).toBe("/usr/bin/cat");
  });

  it("returns input unchanged when command contains a path separator", () => {
    expect(resolveExecutable("./foo")).toBe("./foo");
    expect(resolveExecutable("a/b")).toBe("a/b");
    expect(resolveExecutable("a\\b")).toBe("a\\b");
  });

  if (isWindows) {
    it("resolves bare 'cmd' to System32\\cmd.exe via PATHEXT", () => {
      const resolved = resolveExecutable("cmd");
      expect(resolved.toLowerCase()).toMatch(/system32[\\/]cmd\.exe$/);
      expect(statSync(resolved).isFile()).toBe(true);
    });

    it("resolves bare 'bash' wherever it sits in PATH", () => {
      const resolved = resolveExecutable("bash");
      expect(resolved.toLowerCase()).toMatch(/bash\.exe$/);
      expect(statSync(resolved).isFile()).toBe(true);
    });

    it("returns input unchanged when no PATHEXT match found", () => {
      const result = resolveExecutable("definitely-not-a-real-binary-xyz");
      // No match → returned unchanged so the eventual spawn error stays generic
      expect(result).toBe("definitely-not-a-real-binary-xyz");
    });

    it("respects custom env without mutating process.env", () => {
      const before = process.env.PATH;
      const result = resolveExecutable("cmd", { PATH: "C:\\Windows\\System32" });
      expect(result.toLowerCase()).toMatch(/cmd\.exe$/);
      expect(process.env.PATH).toBe(before);
    });
  }
});

describe("slash command surface", () => {
  let logRoot: string;
  let liveSessionKey: string | undefined;
  let binding: PluginConversationBinding | undefined;

  const cfg = {
    defaultMode: "txt" as const,
    settleIdleMs: 600,
    settleMaxMs: 5000,
    cols: 100,
    rows: 30,
    logDir: "",
  };

  function makeCtx(args: string, override: Partial<PluginCommandContext> = {}): PluginCommandContext {
    const sessionKey = liveSessionKey ?? `cov-${process.pid}-${Date.now()}`;
    liveSessionKey = sessionKey;
    return {
      senderId: "telegram:255433743",
      channel: "telegram",
      isAuthorizedSender: true,
      senderIsOwner: true,
      sessionKey,
      commandBody: `/tui ${args}`,
      args,
      requestConversationBinding: async (
        params: PluginConversationBindingRequestParams,
      ): Promise<PluginConversationBindingRequestResult> => {
        binding = {
          bindingId: "fake-binding-cov",
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
      ...override,
    } as unknown as PluginCommandContext;
  }

  beforeEach(() => {
    logRoot = mkdtempSync(join(tmpdir(), "tui-bridge-cov-"));
    binding = undefined;
    liveSessionKey = undefined;
  });

  afterEach(async () => {
    if (liveSessionKey) {
      await stopSession(liveSessionKey).catch(() => {});
      // Let the PTY worker thread finish its cleanup before we rmSync the dir
      // it was logging to (otherwise we get spurious WindowsPtyAgent errors).
      await new Promise((r) => setTimeout(r, 250));
    }
    liveSessionKey = undefined;
    rmSync(logRoot, { recursive: true, force: true });
  });

  it("/tui (no args) prints help", async () => {
    const r = await handleTuiCommand(makeCtx(""), { pluginConfig: { ...cfg, logDir: logRoot } });
    expect(r.text).toMatch(/TUI Bridge commands/i);
  });

  it("/tui help, /tui ?, /tui -h all print help", async () => {
    for (const sub of ["help", "?", "-h", "--help"]) {
      const r = await handleTuiCommand(makeCtx(sub), {
        pluginConfig: { ...cfg, logDir: logRoot },
      });
      expect(r.text).toMatch(/TUI Bridge commands/i);
    }
  });

  it("/tui list reports no active TUIs when none running", async () => {
    const r = await handleTuiCommand(makeCtx("list"), {
      pluginConfig: { ...cfg, logDir: logRoot },
    });
    expect(r.text).toMatch(/No active TUIs/i);
  });

  it("/tui status before start reports no binding", async () => {
    const r = await handleTuiCommand(makeCtx("status"), {
      pluginConfig: { ...cfg, logDir: logRoot },
    });
    expect(r.text).toMatch(/No TUI bound|No active conversation session/i);
  });

  it("/tui mode txt before start reports no binding", async () => {
    const r = await handleTuiCommand(makeCtx("mode txt"), {
      pluginConfig: { ...cfg, logDir: logRoot },
    });
    expect(r.text).toMatch(/No TUI bound/i);
  });

  it("/tui mode (no arg) prints usage", async () => {
    const r = await handleTuiCommand(makeCtx("mode"), {
      pluginConfig: { ...cfg, logDir: logRoot },
    });
    expect(r.text).toMatch(/Usage: \/tui mode txt\|tui/i);
  });

  it("/tui peek before start reports no binding", async () => {
    const r = await handleTuiCommand(makeCtx("peek"), {
      pluginConfig: { ...cfg, logDir: logRoot },
    });
    expect(r.text).toMatch(/No TUI bound/i);
  });

  it("/tui start <unknown-binary> reports failure", async () => {
    const r = await handleTuiCommand(makeCtx("start definitely-not-real-binary-xyz"), {
      pluginConfig: { ...cfg, logDir: logRoot },
    });
    expect(r.text).toMatch(/Failed to start TUI/i);
    // No binding should have been created on failure
    expect(binding).toBeUndefined();
  });

  it("/tui start with no args prints usage", async () => {
    const r = await handleTuiCommand(makeCtx("start"), {
      pluginConfig: { ...cfg, logDir: logRoot },
    });
    expect(r.text).toMatch(/Usage: \/tui start/i);
  });

  it("allowedCommands gates which binaries can be started", async () => {
    const r = await handleTuiCommand(makeCtx("start cmd"), {
      pluginConfig: { ...cfg, logDir: logRoot, allowedCommands: ["bash"] },
    });
    expect(r.text).toMatch(/not in allowedCommands/i);
    expect(binding).toBeUndefined();
  });

  it("bogus subcommand returns 'Unknown subcommand' + help", async () => {
    const r = await handleTuiCommand(makeCtx("explode"), {
      pluginConfig: { ...cfg, logDir: logRoot },
    });
    expect(r.text).toMatch(/Unknown subcommand: explode/i);
    expect(r.text).toMatch(/TUI Bridge commands/i);
  });

  if (isWindows) {
    it("full happy path: start cmd → status → mode → list → stop", async () => {
      // Start
      const start = await handleTuiCommand(makeCtx("start cmd"), {
        pluginConfig: { ...cfg, logDir: logRoot },
      });
      expect(start.text).toMatch(/Bound this conversation to TUI .*cmd/i);
      expect(getSession(liveSessionKey!)).toBeDefined();

      // Status now shows binding
      const status = await handleTuiCommand(makeCtx("status"), {
        pluginConfig: { ...cfg, logDir: logRoot },
      });
      expect(status.text).toMatch(/Bound TUI/i);
      expect(status.text).toMatch(/cmd/i);

      // Mode toggle
      const mode = await handleTuiCommand(makeCtx("mode tui"), {
        pluginConfig: { ...cfg, logDir: logRoot },
      });
      expect(mode.text).toMatch(/Output mode set to tui/i);
      expect(getSession(liveSessionKey!)?.mode).toBe("tui");

      // List shows the running session
      const list = await handleTuiCommand(makeCtx("list"), {
        pluginConfig: { ...cfg, logDir: logRoot },
      });
      expect(list.text).toMatch(/Active TUIs/i);
      expect(list.text).toMatch(/cmd/i);

      // Stop
      const stop = await handleTuiCommand(makeCtx("stop"), {
        pluginConfig: { ...cfg, logDir: logRoot },
      });
      expect(stop.text).toMatch(/TUI stopped/i);
      expect(getSession(liveSessionKey!)).toBeUndefined();
      expect(binding).toBeUndefined();

      // listSessions() should now be empty (or at least not contain ours)
      const surviving = listSessions().some((s) => s.sessionKey === liveSessionKey);
      expect(surviving).toBe(false);
    });

    it("inbound_claim writes plain text to bash and returns its output", async () => {
      const start = await handleTuiCommand(makeCtx("start bash"), {
        pluginConfig: { ...cfg, logDir: logRoot },
      });
      expect(start.text).toMatch(/Bound this conversation to TUI .*bash/i);

      const inboundCtx = {
        sessionKey: liveSessionKey,
        pluginBinding: binding,
      } as unknown as PluginHookInboundClaimContext;

      // Multi-step: pwd then echo, both must come back
      const r1 = await handleTuiInboundClaim(
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
      expect(r1?.handled).toBe(true);
      expect(r1?.reply?.text).toMatch(/\$ pwd/);

      const r2 = await handleTuiInboundClaim(
        {
          content: "echo hello-second-message",
          bodyForAgent: "echo hello-second-message",
          channel: "telegram",
          isGroup: false,
          commandAuthorized: true,
        },
        inboundCtx,
        { pluginConfig: { ...cfg, logDir: logRoot } },
      );
      expect(r2?.handled).toBe(true);
      expect(r2?.reply?.text).toContain("hello-second-message");
    });

    it("inbound_claim drops messages when commandAuthorized is false", async () => {
      const start = await handleTuiCommand(makeCtx("start bash"), {
        pluginConfig: { ...cfg, logDir: logRoot },
      });
      expect(start.text).toMatch(/Bound/i);

      const inboundCtx = {
        sessionKey: liveSessionKey,
        pluginBinding: binding,
      } as unknown as PluginHookInboundClaimContext;

      const r = await handleTuiInboundClaim(
        {
          content: "rm -rf /",
          bodyForAgent: "rm -rf /",
          channel: "telegram",
          isGroup: false,
          commandAuthorized: false,
        },
        inboundCtx,
        { pluginConfig: { ...cfg, logDir: logRoot } },
      );
      expect(r).toEqual({ handled: true });
      // bash should still be alive — we didn't write anything
      expect(getSession(liveSessionKey!)).toBeDefined();
    });

    it("inbound_claim with no plugin binding returns undefined (no claim)", async () => {
      const r = await handleTuiInboundClaim(
        {
          content: "anything",
          bodyForAgent: "anything",
          channel: "telegram",
          isGroup: false,
          commandAuthorized: true,
        },
        { sessionKey: "no-binding-session" } as PluginHookInboundClaimContext,
        { pluginConfig: { ...cfg, logDir: logRoot } },
      );
      expect(r).toBeUndefined();
    });

    it("/tui restart respawns with the same command", async () => {
      const start = await handleTuiCommand(makeCtx("start bash"), {
        pluginConfig: { ...cfg, logDir: logRoot },
      });
      expect(start.text).toMatch(/Bound/i);
      const firstSession = getSession(liveSessionKey!);
      expect(firstSession).toBeDefined();
      const firstPid = firstSession!.pty.pid;

      const restart = await handleTuiCommand(makeCtx("restart"), {
        pluginConfig: { ...cfg, logDir: logRoot },
      });
      expect(restart.text).toMatch(/Bound this conversation to TUI .*bash/i);

      // Wait briefly for ConPTY to assign new pid
      for (let i = 0; i < 40 && !(getSession(liveSessionKey!)?.pty.pid > 0); i++) {
        await new Promise((r) => setTimeout(r, 25));
      }
      const secondSession = getSession(liveSessionKey!);
      expect(secondSession).toBeDefined();
      // New PTY → different pid
      expect(secondSession!.pty.pid).not.toBe(firstPid);
    });
  }
});
