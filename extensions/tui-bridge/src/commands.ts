import process from "node:process";
import type {
  OpenClawPluginCommandDefinition,
  PluginCommandContext,
  PluginCommandResult,
} from "openclaw/plugin-sdk/plugin-entry";
import { createBindingData, readBindingData } from "./binding-data.js";
import { defaultLogRoot } from "./persistence.js";
import {
  getSession,
  listSessions,
  startSession,
  stopSession,
  writeStdin,
  waitForSettle,
  readReply,
} from "./process-pool.js";
import { resolveConfig, type TuiMode } from "./types.js";

const HELP_TEXT = [
  "TUI Bridge commands:",
  "  /tui start <cmd> [args...]      Spawn a TUI bound to this chat (e.g. /tui start claude)",
  "  /tui stop                       Kill the bound TUI",
  "  /tui restart                    Restart with the same command",
  "  /tui list                       List active TUIs across all conversations",
  "  /tui mode txt|tui               Toggle output mode (default per config)",
  "  /tui peek                       Send the latest screen snapshot to chat",
  "  /tui send <text>                Send raw text to stdin (no newline)",
  "  /tui sendln <text>              Send text + newline (default for normal messages)",
  "  /tui status                     Show this conversation's binding",
].join("\n");

export function createTuiCommand(options: {
  pluginConfig?: unknown;
}): OpenClawPluginCommandDefinition {
  return {
    name: "tui",
    description: "Bind a chat to a long-lived TUI process and pipe stdin/stdout.",
    ownership: "reserved",
    acceptsArgs: true,
    requireAuth: true,
    handler: (ctx) => handleTuiCommand(ctx, options),
  };
}

export async function handleTuiCommand(
  ctx: PluginCommandContext,
  options: { pluginConfig?: unknown } = {},
): Promise<PluginCommandResult> {
  const args = parseArgs(ctx.argString ?? "");
  const sub = (args.shift() ?? "help").toLowerCase();
  const cfg = resolveConfig(options.pluginConfig);

  if (sub === "help" || sub === "?" || sub === "-h" || sub === "--help") {
    return { text: HELP_TEXT };
  }
  if (sub === "list") return { text: formatList() };
  if (sub === "status") return { text: formatStatus(ctx) };

  if (sub === "start") {
    if (args.length === 0) return { text: "Usage: /tui start <cmd> [args...]" };
    const [cmd, ...rest] = args;
    if (!cmd) return { text: "Usage: /tui start <cmd> [args...]" };
    if (
      cfg.allowedCommands &&
      cfg.allowedCommands.length > 0 &&
      !cfg.allowedCommands.includes(cmd)
    ) {
      return {
        text: `Command "${cmd}" is not in allowedCommands: ${cfg.allowedCommands.join(", ")}`,
      };
    }
    return await handleStart(ctx, cmd, rest, cfg);
  }

  const sessionKey = ctx.sessionKey;
  if (!sessionKey) {
    return { text: "This command requires an active conversation session." };
  }

  if (sub === "stop") {
    const ok = await stopSession(sessionKey);
    try {
      await ctx.detachConversationBinding();
    } catch {}
    return { text: ok ? "TUI stopped." : "No TUI bound to this conversation." };
  }

  if (sub === "restart") {
    const binding = await ctx.getCurrentConversationBinding();
    const data = readBindingData(binding);
    if (!data) return { text: "No TUI bound to this conversation. Use /tui start <cmd>." };
    await stopSession(sessionKey);
    return await handleStart(ctx, data.command, data.args, cfg, data.mode);
  }

  if (sub === "mode") {
    const m = (args[0] ?? "").toLowerCase();
    if (m !== "txt" && m !== "tui") return { text: "Usage: /tui mode txt|tui" };
    const session = getSession(sessionKey);
    if (!session) return { text: "No TUI bound to this conversation." };
    session.mode = m;
    return { text: `Output mode set to ${m}.` };
  }

  if (sub === "peek") {
    const session = getSession(sessionKey);
    if (!session) return { text: "No TUI bound to this conversation." };
    await waitForSettle(session, { idleMs: cfg.settleIdleMs, maxMs: 1500 });
    const snap = readReply(session);
    return { text: snap || "(empty)" };
  }

  if (sub === "send" || sub === "sendln") {
    const session = getSession(sessionKey);
    if (!session) return { text: "No TUI bound to this conversation." };
    const payload = (ctx.argString ?? "").replace(/^\s*\S+\s*/, "");
    writeStdin(session, sub === "sendln" ? `${payload}\n` : payload);
    await waitForSettle(session, { idleMs: cfg.settleIdleMs, maxMs: cfg.settleMaxMs });
    return { text: readReply(session) || "(no output)" };
  }

  return { text: `Unknown subcommand: ${sub}\n${HELP_TEXT}` };
}

async function handleStart(
  ctx: PluginCommandContext,
  cmd: string,
  argv: string[],
  cfg: ReturnType<typeof resolveConfig>,
  modeOverride?: TuiMode,
): Promise<PluginCommandResult> {
  const sessionKey = ctx.sessionKey;
  if (!sessionKey) return { text: "Cannot start a TUI without an active conversation session." };
  const cwd = process.cwd();
  const mode: TuiMode = modeOverride ?? cfg.defaultMode;
  const logRoot = cfg.logDir ?? defaultLogRoot();

  try {
    await startSession({
      sessionKey,
      command: cmd,
      args: argv,
      cwd,
      mode,
      cols: cfg.cols,
      rows: cfg.rows,
      logRoot,
    });
  } catch (error) {
    return { text: `Failed to start TUI: ${(error as Error).message}` };
  }

  const summary = `TUI ${cmd}${argv.length > 0 ? " " + argv.join(" ") : ""} (${mode}) in ${cwd}`;
  try {
    const result = await ctx.requestConversationBinding({
      summary,
      detachHint: "/tui stop",
      data: createBindingData({ command: cmd, args: argv, cwd, mode }),
    });
    if (result.status === "bound") {
      return {
        text: `Bound this conversation to ${summary}. Type messages to drive its stdin; use /tui help for controls.`,
      };
    }
    if (result.status === "pending") {
      return result.reply;
    }
    await stopSession(sessionKey);
    return { text: `Could not bind conversation: ${result.message}` };
  } catch (error) {
    await stopSession(sessionKey);
    return { text: `Could not bind conversation: ${(error as Error).message}` };
  }
}

function parseArgs(input: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quote) {
      if (c === quote) quote = null;
      else cur += c;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === " " || c === "\t") {
      if (cur) {
        out.push(cur);
        cur = "";
      }
    } else {
      cur += c;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function formatList(): string {
  const sessions = listSessions();
  if (sessions.length === 0) return "No active TUIs.";
  const lines = ["Active TUIs:"];
  for (const s of sessions) {
    const age = Math.round((Date.now() - s.startedAt) / 1000);
    const exit = s.exitInfo ? ` [exited code=${s.exitInfo.code ?? "?"}]` : "";
    lines.push(`  ${s.sessionKey}  ${s.command} ${s.args.join(" ")}  (${s.mode}, ${age}s)${exit}`);
  }
  return lines.join("\n");
}

function formatStatus(ctx: PluginCommandContext): string {
  const sessionKey = ctx.sessionKey;
  if (!sessionKey) return "No active conversation session.";
  const s = getSession(sessionKey);
  if (!s) return "No TUI bound to this conversation. Use /tui start <cmd>.";
  const age = Math.round((Date.now() - s.startedAt) / 1000);
  return `Bound TUI: ${s.command} ${s.args.join(" ")}\n  mode=${s.mode} cwd=${s.cwd} age=${age}s log=${s.logPath}`;
}
