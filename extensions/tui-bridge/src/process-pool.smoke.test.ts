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
      command: process.execPath,
      // Linger so the PTY (ConPTY on Windows) has time to expose pid before exit.
      args: [
        "-e",
        "process.stdout.write('hello-from-pty\\n'); setTimeout(() => process.exit(0), 500);",
      ],
      cwd: process.cwd(),
      mode: "txt",
      cols: 80,
      rows: 24,
      logRoot,
    });

    // ConPTY assigns pid asynchronously; allow a beat before asserting.
    for (let i = 0; i < 40 && !(session.pty.pid > 0); i++) {
      await new Promise((r) => setTimeout(r, 25));
    }
    expect(session.pty.pid).toBeGreaterThan(0);
    expect(getSession(sessionKey)).toBe(session);

    // Wait for exit so exitInfo is populated before we assert on it.
    for (let i = 0; i < 80 && !session.exitInfo; i++) {
      await new Promise((r) => setTimeout(r, 25));
    }
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
      // node piping stdin to stdout blocks reading from stdin -- a long-lived process
      command: process.execPath,
      args: ["-e", "process.stdin.pipe(process.stdout); setInterval(() => {}, 1e9);"],
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
