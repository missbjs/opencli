import type { Command } from "commander";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";
import { parseTimeoutMs } from "./parse-timeout.js";

export function registerTuiCli(program: Command) {
  program
    .command("tui")
    .alias("terminal")
    .alias("chat")
    .description("Open a terminal UI connected to the Gateway")
    .option("--local", "Run against the local embedded agent runtime", false)
    .option("--url <url>", "Gateway WebSocket URL (defaults to gateway.remote.url when configured)")
    .option("--token <token>", "Gateway token (if required)")
    .option("--password <password>", "Gateway password (if required)")
    .option("--session <key>", 'Session key (default: "main", or "global" when scope is global)')
    .option("--deliver", "Deliver assistant replies", false)
    .option("--thinking <level>", "Thinking level override")
    .option("--message <text>", "Send an initial message after connecting")
    .option(
      "--once",
      "Non-interactive: send --message, capture the first assistant reply, print it to stdout, and exit",
      false,
    )
    .option("--timeout-ms <ms>", "Agent timeout in ms (defaults to agents.defaults.timeoutSeconds)")
    .option("--history-limit <n>", "History entries to load", "200")
    .addHelpText(
      "after",
      () => `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/tui", "docs.opencli.ai/cli/tui")}\n`,
    )
    .action(async (opts, _cmd) => {
      try {
        // chat / terminal / tui all behave the same: connect to the running
        // gateway via WS by default; pass --local to use the embedded runtime.
        const isLocal = Boolean(opts.local);
        if (isLocal && (opts.url || opts.token || opts.password)) {
          throw new Error("--local cannot be combined with --url, --token, or --password");
        }
        const timeoutMs = parseTimeoutMs(opts.timeoutMs);
        if (opts.timeoutMs !== undefined && timeoutMs === undefined) {
          defaultRuntime.error(
            `warning: invalid --timeout-ms "${String(opts.timeoutMs)}"; ignoring`,
          );
        }
        const historyLimit = Number.parseInt(String(opts.historyLimit ?? "200"), 10);
        // Auto-enable once-mode when --message is set and stdin is piped (non-TTY).
        // Explicit --once always wins. --once requires --message; reject otherwise.
        const onceFlag = Boolean(opts.once);
        const messageProvided = typeof opts.message === "string" && opts.message.length > 0;
        const stdinIsTty = Boolean(process.stdin.isTTY);
        const onceAuto = !onceFlag && messageProvided && !stdinIsTty;
        const once = onceFlag || onceAuto;
        if (onceFlag && !messageProvided) {
          throw new Error("--once requires --message <text>");
        }
        const { runTui } = await import("../tui/tui.js");
        const result = await runTui({
          local: isLocal,
          url: opts.url as string | undefined,
          token: opts.token as string | undefined,
          password: opts.password as string | undefined,
          session: opts.session as string | undefined,
          deliver: Boolean(opts.deliver),
          thinking: opts.thinking as string | undefined,
          message: opts.message as string | undefined,
          once,
          timeoutMs,
          historyLimit: Number.isNaN(historyLimit) ? undefined : historyLimit,
        });
        if (once) {
          if (result.firstReply) {
            process.stdout.write(`${result.firstReply.text}\n`);
          } else if (result.onceError) {
            defaultRuntime.error(`once: ${result.onceError}`);
            defaultRuntime.exit(1);
          } else {
            defaultRuntime.error("once: no reply received before exit");
            defaultRuntime.exit(1);
          }
        }
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });
}
