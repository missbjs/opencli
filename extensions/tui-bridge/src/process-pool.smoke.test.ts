import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getSession, readReply, startSession, stopSession, waitForSettle } from "./process-pool.js";

describe("tui-bridge process-pool smoke", () => {
  let logRoot: string;
  const liveKeys = new Set<string>();

  beforeEach(() => {
    logRoot = mkdtempSync(join(tmpdir(), "tui-bridge-smoke-"));
  });

  afterEach(async () => {
    for (const key of liveKeys) {
      await stopSession(key).catch(() => {});
    }
    liveKeys.clear();
    rmSync(logRoot, { recursive: true, force: true });
  });

  function track(key: string): string {
    liveKeys.add(key);
    return key;
  }

  it("spawns a real PTY, settles after echo output, and readReply returns the line", async () => {
    const sessionKey = track(`smoke-echo-${process.pid}-${Date.now()}`);
    const session = await startSession({
      sessionKey,
      command: "/usr/bin/echo",
      args: ["hello-from-pty"],
      cwd: logRoot,
      mode: "txt",
      cols: 80,
      rows: 24,
      logRoot,
    });

    expect(session.pty.pid).toBeGreaterThan(0);
    expect(getSession(sessionKey)).toBe(session);

    await waitForSettle(session, { idleMs: 200, maxMs: 4000 });

    expect(session.exitInfo).toBeDefined();
    expect(session.exitInfo?.code).toBe(0);

    const reply = readReply(session);
    expect(reply).toContain("hello-from-pty");
    // readReply drains the buffers
    expect(session.txtBuffer).toBe("");
    expect(session.buffer).toBe("");
  });

  it("stopSession kills the PTY and removes it from the registry", async () => {
    const sessionKey = track(`smoke-stop-${process.pid}-${Date.now()}`);
    const session = await startSession({
      sessionKey,
      // `cat` with no args blocks reading from stdin -- a long-lived process
      command: "/usr/bin/cat",
      args: [],
      cwd: logRoot,
      mode: "txt",
      cols: 80,
      rows: 24,
      logRoot,
    });

    expect(getSession(sessionKey)).toBe(session);
    expect(session.exitInfo).toBeUndefined();

    const stopped = await stopSession(sessionKey);
    expect(stopped).toBe(true);
    expect(getSession(sessionKey)).toBeUndefined();

    // A second stop on an unknown key must be a no-op returning false.
    expect(await stopSession(sessionKey)).toBe(false);
  });
});
