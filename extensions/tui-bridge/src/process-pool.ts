import { appendFile } from "node:fs/promises";
import { ensureSessionDir, sessionLogPath } from "./persistence.js";
import { createTuiScreen, scrubTxt, type TuiScreen } from "./screen.js";
import type { TuiMode } from "./types.js";

type PtyDisposable = { dispose: () => void };
type PtyExitEvent = { exitCode: number; signal?: number };
type PtySpawnHandle = {
  pid: number;
  write: (data: string | Buffer) => void;
  onData: (listener: (value: string) => void) => PtyDisposable | void;
  onExit: (listener: (event: PtyExitEvent) => void) => PtyDisposable | void;
  kill: (signal?: string) => void;
};
type PtySpawn = (
  file: string,
  args: string[] | string,
  options: {
    name?: string;
    cols?: number;
    rows?: number;
    cwd?: string;
    env?: Record<string, string>;
  },
) => PtySpawnHandle;
type PtyModule = {
  spawn?: PtySpawn;
  default?: { spawn?: PtySpawn };
};

let ptyModulePromise: Promise<PtyModule> | null = null;
async function loadPtyModule(): Promise<PtyModule> {
  ptyModulePromise ??= import("@lydell/node-pty") as Promise<unknown> as Promise<PtyModule>;
  return ptyModulePromise;
}

export type Session = {
  sessionKey: string;
  pty: PtySpawnHandle;
  command: string;
  args: string[];
  cwd: string;
  mode: TuiMode;
  startedAt: number;
  screen?: TuiScreen;
  buffer: string;
  txtBuffer: string;
  logPath: string;
  exitInfo?: { code: number | undefined; signal: number | undefined };
};

const SESSIONS_KEY = Symbol.for("openclaw.tui-bridge.sessions");
type SessionState = { byKey: Map<string, Session> };
function state(): SessionState {
  const g = globalThis as typeof globalThis & { [SESSIONS_KEY]?: SessionState };
  g[SESSIONS_KEY] ??= { byKey: new Map() };
  return g[SESSIONS_KEY];
}

export function getSession(sessionKey: string): Session | undefined {
  return state().byKey.get(sessionKey);
}

export function listSessions(): Session[] {
  return Array.from(state().byKey.values());
}

export type StartParams = {
  sessionKey: string;
  command: string;
  args: string[];
  cwd: string;
  mode: TuiMode;
  cols: number;
  rows: number;
  logRoot: string;
};

export async function startSession(params: StartParams): Promise<Session> {
  const existing = state().byKey.get(params.sessionKey);
  if (existing) {
    throw new Error(
      `A TUI is already bound to this conversation (${existing.command}). Run /tui stop first.`,
    );
  }
  const ptyMod = await loadPtyModule();
  const spawn = ptyMod.spawn ?? ptyMod.default?.spawn;
  if (!spawn) {
    throw new Error("PTY support is unavailable (@lydell/node-pty spawn not found).");
  }
  await ensureSessionDir(params.logRoot, params.sessionKey);
  const logPath = sessionLogPath(params.logRoot, params.sessionKey);
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string") env[k] = v;
  }
  const pty = spawn(params.command, params.args, {
    name: "xterm-256color",
    cols: params.cols,
    rows: params.rows,
    cwd: params.cwd,
    env,
  });
  const session: Session = {
    sessionKey: params.sessionKey,
    pty,
    command: params.command,
    args: params.args,
    cwd: params.cwd,
    mode: params.mode,
    startedAt: Date.now(),
    buffer: "",
    txtBuffer: "",
    logPath,
  };
  if (params.mode === "tui") {
    session.screen = await createTuiScreen(params.cols, params.rows);
  }
  pty.onData((d) => {
    session.buffer += d;
    if (session.screen) session.screen.feed(d);
    session.txtBuffer += scrubTxt(d);
    appendFile(logPath, d).catch(() => {});
  });
  pty.onExit(({ exitCode, signal }) => {
    session.exitInfo = { code: exitCode, signal };
  });
  state().byKey.set(params.sessionKey, session);
  return session;
}

export function writeStdin(session: Session, text: string): void {
  session.pty.write(text);
}

export async function stopSession(sessionKey: string): Promise<boolean> {
  const s = state().byKey.get(sessionKey);
  if (!s) return false;
  try {
    s.pty.kill();
  } catch {}
  s.screen?.dispose();
  state().byKey.delete(sessionKey);
  return true;
}

export type SettleParams = {
  idleMs: number;
  maxMs: number;
};

export async function waitForSettle(session: Session, p: SettleParams): Promise<void> {
  const startAt = Date.now();
  let lastSize = session.buffer.length;
  let lastChange = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      if (session.exitInfo) return resolve();
      const now = Date.now();
      const size = session.buffer.length;
      if (size !== lastSize) {
        lastSize = size;
        lastChange = now;
      }
      if (now - lastChange >= p.idleMs) return resolve();
      if (now - startAt >= p.maxMs) return resolve();
      setTimeout(tick, Math.min(100, p.idleMs / 4));
    };
    setTimeout(tick, Math.min(100, p.idleMs / 4));
  });
}

export function readReply(session: Session): string {
  if (session.mode === "tui" && session.screen) {
    const snap = session.screen.snapshot();
    session.txtBuffer = "";
    session.buffer = "";
    return snap;
  }
  const out = session.txtBuffer;
  session.txtBuffer = "";
  session.buffer = "";
  return out;
}
