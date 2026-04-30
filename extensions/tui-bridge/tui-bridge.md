# TUI Bridge

Bind a chat conversation to a long-lived TUI/CLI process. Each conversation
owns one PTY-spawned binary; user messages are written to its stdin, screen
output is streamed back as chat replies.

```
human → messager (Telegram/Discord/…) → openclaw gateway → tui-bridge → PTY → claude/codex/aider/…
                                            ↑__________________________________|
                                                 (output streams back)
```

The LLM agent loop is bypassed entirely — tui-bridge claims inbound messages
before openclaw's agent runs, so no provider API key is consumed on the
openclaw side. Whatever auth the spawned binary needs (Anthropic session for
`claude`, `OPENAI_API_KEY` for `codex`, etc.) is its own concern.

## Quick start

### 1. Build (one-time)

```
pnpm install
pnpm build
```

`dist-runtime/extensions/tui-bridge/` should appear after the build.

### 2. Enable the plugin

```
pnpm dev plugins enable tui-bridge
```

The plugin ships disabled by default (`activation.onStartup: false` in the
manifest). On hosts where `plugins enable` hangs (some PRoot/Termux setups),
edit the openclaw config directly and flip `tui-bridge` to enabled. State
lives under `~/.openclaw/` (or `~/.openclaw-dev/` if you launch with `--dev`).

### 3. Add at least one channel

You need a way for messages to reach the gateway. Pick one:

```
pnpm dev channels add --channel telegram --token <BOT_TOKEN>
pnpm dev channels add --channel discord  --token <BOT_TOKEN>
# …or any other supported channel — see `pnpm dev channels --help`
```

For a fully local loop (no real messager), see [Testing without a
messager](#testing-without-a-messager) below.

### 4. Start the gateway

```
pnpm dev gateway run         # foreground, easiest to debug
# or
pnpm dev gateway start       # daemonize (launchd/systemd)
pnpm dev gateway status
pnpm dev gateway stop
```

### 5. Drive a TUI from chat

In your messager, send the bot:

```
/tui start claude
```

The bot replies once Claude Code is spawned and the conversation is bound.
Subsequent messages are piped to Claude's stdin; its rendered screen comes
back to chat after a short settle window.

## Slash commands

All commands take effect on the conversation they are sent in.

| Command                    | Effect                                                      |
| -------------------------- | ----------------------------------------------------------- |
| `/tui start <cmd> [args…]` | Spawn `<cmd>`, bind this conversation to it                 |
| `/tui stop`                | Kill the bound process and detach the binding               |
| `/tui restart`             | Kill + respawn with the same command/args/mode              |
| `/tui list`                | List all active TUIs across all conversations               |
| `/tui status`              | Show this conversation's binding (cmd, mode, age, log path) |
| `/tui mode txt\|tui`       | Toggle output format (see [Modes](#output-modes))           |
| `/tui peek`                | Force a fresh screen snapshot to chat                       |
| `/tui send <text>`         | Write raw bytes to stdin (no newline)                       |
| `/tui sendln <text>`       | Write text + `\n` (this is what plain chat messages do)     |
| `/tui help`                | Print the command reference                                 |

Plain (non-slash) messages on a bound conversation are equivalent to
`/tui sendln <message>`.

## Output modes

- **`txt`** _(default)_ — strips ANSI escape sequences from raw PTY output and
  streams the resulting text. Best for line-oriented programs (`bash`, REPLs,
  log tails). Cheap and predictable.
- **`tui`** — feeds raw bytes into a headless `@xterm/headless` Terminal and
  emits the full rendered screen on each settle. Best for full-screen
  curses-style apps (`htop`, `vim`, `claude`'s alt-screen UI, `codex`).
  Heavier — keeps a virtual terminal in memory per session.

Switch with `/tui mode txt|tui` after starting; pick the default with the
`defaultMode` config key.

## Configuration

Set per-plugin config via openclaw's standard plugin config surface
(`pnpm dev configure --section plugins`, or edit the plugin's entry in the
config file). Schema:

| Key               | Default                   | Description                                                      |
| ----------------- | ------------------------- | ---------------------------------------------------------------- |
| `defaultMode`     | `txt`                     | Mode for new sessions (`txt` or `tui`)                           |
| `settleIdleMs`    | `600`                     | Idle gap before output is considered "settled" and sent          |
| `settleMaxMs`     | `30000`                   | Hard cap before forcing a flush even if output is still arriving |
| `cols`            | `100`                     | Terminal columns for spawned PTYs                                |
| `rows`            | `30`                      | Terminal rows for spawned PTYs                                   |
| `logDir`          | `~/.openclaw/tui-bridge/` | Where per-session logs go                                        |
| `allowedCommands` | _(unset)_                 | If set, only these binary names may be `start`-ed                |

`allowedCommands` is the security knob — set it to `["claude", "codex",
"aider"]` (for example) to prevent arbitrary binaries from being spawned by
chat slash commands.

## Logs and persistence

Each session writes a raw byte log to:

```
~/.openclaw/tui-bridge/<safe-session-key>/session.log
```

`<safe-session-key>` is the openclaw `sessionKey` (`channel:thread`)
slugified plus a 12-char SHA1 suffix to keep paths unique and filesystem-safe.
The log captures everything the PTY emitted, useful for postmortem when the
bridge replied with a snapshot but you want the full sequence.

If openclaw is restarted while a binding is still on disk, the next inbound
message on that conversation respawns the process with the original
command/args/cwd/mode (stored in the binding's `data` payload).

## Testing without a messager

You don't need a real Telegram/Discord setup to iterate on the bridge.

### Unit-level smoke

The repo ships `extensions/tui-bridge/src/process-pool.smoke.test.ts` —
spawn → settle → readReply round-trip plus stop-session cleanup.

```
pnpm test extensions/tui-bridge/src/process-pool.smoke.test.ts
```

This runs a real `@lydell/node-pty` (no mocks) — it's the cheapest way to
confirm PTY spawning and the buffer/snapshot machinery work on your host.

### Manual smoke (module level)

Verify the plugin module loads and exposes the SDK contract:

```
node -e "
import('./dist-runtime/extensions/tui-bridge/index.js').then(m => {
  const def = m.default;
  console.log({ id: def.id, name: def.name, hasRegister: typeof def.register });
});
"
```

Expected: `{ id: 'tui-bridge', name: 'TUI Bridge', hasRegister: 'function' }`.

### End-to-end without a real messager

openclaw ships a local-channel mode for exactly this — a terminal client that
talks to the gateway as if it were a chat surface:

```
pnpm dev gateway run        # in one terminal
pnpm dev chat               # in another (alias for `tui --local`)
```

Inside the local chat session, send `/tui start bash`, then type `pwd`, `ls`,
etc. The bridge spawns bash, pipes your text to its stdin, and the prompt
output comes back as a "chat" reply. This is the recommended dev loop — no
bot tokens, no network.

> **Note:** the `pnpm dev chat` path was not exercised end-to-end on this
> repo's PRoot/Android host; if it doesn't connect, fall back to the
> Telegram-bot route or the unit smoke above.

### Direct hook invocation (advanced)

For tighter integration tests, import the handler functions directly from
`extensions/tui-bridge/src/inbound-claim.ts` and call them with synthetic
`PluginHookInboundClaimEvent` / `PluginHookInboundClaimContext` shapes. The
SDK types for those events are exported from
`openclaw/plugin-sdk/plugin-entry`. This bypasses the gateway and channel
layers entirely; use it to stress edge cases (no-binding, unauthorized,
empty-body, exited-process) without a running daemon.

## Internals (one paragraph)

`process-pool.ts` owns a global `Map<sessionKey, Session>` keyed via
`Symbol.for("openclaw.tui-bridge.sessions")`, so the registry survives module
re-imports inside a single Node process. Each `Session` carries the live
`@lydell/node-pty` handle, a raw byte `buffer`, an ANSI-stripped `txtBuffer`,
and (in `tui` mode) an `@xterm/headless` Terminal that scrubs into a
snapshot. `waitForSettle` polls buffer size with a 100ms tick and resolves on
either an idle window of `idleMs` or a hard cap of `maxMs`. The
`inbound_claim` hook reads the conversation's binding (via
`ctx.pluginBinding`), respawns the PTY if needed, writes the user's text
plus newline, awaits settle, and returns the reply payload. Slash commands
share the same primitives but additionally call
`ctx.requestConversationBinding(...)` on `start` to mark the conversation as
plugin-owned, and `ctx.detachConversationBinding()` on `stop`.

## Troubleshooting

| Symptom                                                        | Likely cause                                                            | Fix                                                                              |
| -------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `pnpm dev plugins inspect tui-bridge` shows `Status: disabled` | Default activation is `onStartup: false`                                | `pnpm dev plugins enable tui-bridge`                                             |
| `Failed to start TUI: spawn <cmd> ENOENT`                      | Binary not on `PATH` for the gateway process                            | Use a full path, or ensure the binary is installed where the gateway runs        |
| Replies arrive but look mangled                                | App expects a real terminal (cursor moves, clears) but is in `txt` mode | `/tui mode tui`                                                                  |
| `tui` mode replies are huge / scroll back lost                 | Snapshot is full screen each time                                       | Increase `cols`/`rows`, or stick with `txt` mode                                 |
| Bot goes silent after first message                            | App is waiting for input but stdin echo wasn't sent with newline        | Use `/tui sendln` or send a plain message (always appends `\n`)                  |
| `Could not bind conversation: …`                               | Some channel/account combos require approval — message body explains    | Approve via openclaw's binding-approval flow, then retry                         |
| PTY logs not appearing                                         | `logDir` not writable                                                   | Override via plugin config `logDir`, or check perms on `~/.openclaw/tui-bridge/` |

## Reference

- Plugin SDK docs: `docs/plugins/sdk-overview.md`
- Manifest format: `docs/plugins/manifest.md`
- Conversation bindings (the API used by `/tui start`):
  `src/plugins/conversation-binding.types.ts`
- Inbound-claim hook contract: `src/plugins/hook-message.types.ts`
- PTY adapter pattern this extension mirrors:
  `src/process/supervisor/adapters/pty.ts`
