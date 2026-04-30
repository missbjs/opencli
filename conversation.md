# Session log — tui-bridge install/build/test/wire-up + new direction

Resumable on another device. Repo: `https://github.com/missbjs/opencli`, branch `main`.
Last meaningful commit: `7a08c0415e dev stage` (carries all code changes from this session).

---

## 1. What this session set out to do

Original ask: "install, build, test this folder" — `extensions/tui-bridge`.

That snowballed into:

1. Fix the tui-bridge plugin so it actually loads inside the gateway.
2. Stand up the OpenClaw gateway on this Windows PC from a fresh source build.
3. Connect a real Telegram bot (`@chichongpc_bot`) and drive a TUI from chat — without involving any LLM.
4. End-to-end testing.
5. Pre-approve the plugin's conversation binding so it works without an interactive Allow/Deny prompt.
6. **NEW direction (last user message before this log):** strip every LLM/API call from the
   repo, rebrand `openclaw` → `opencli`, and make `pnpm opencli chat --message "..."`
   a non-interactive one-shot (execute, return result, exit). User is going to
   branch/split/unfork from upstream/main.

---

## 2. Bugs found and fixed (all in commit `7a08c0415e`)

| File | Issue | Fix |
|---|---|---|
| `extensions/tui-bridge/src/commands.ts:50, 117` | Used `ctx.argString` — that field was renamed to `args` in the SDK | Changed to `ctx.args` |
| `extensions/tui-bridge/src/commands.ts:39` | `ownership: "reserved"` rejected by validator (`tui` is not on the reserved-name allowlist with `help`/`status`/`codex`/etc.) | Removed the field; it's a normal plugin command now |
| `extensions/tui-bridge/openclaw.plugin.json` | `activation.onStartup: false` made the plugin "available but inert" — config `enabled: true` does NOT override it | Set `activation.onStartup: true` |
| `extensions/tui-bridge/src/process-pool.ts` | Windows ConPTY (via `@lydell/node-pty`) does not search `PATH`/`PATHEXT` like the shell does — bare `cmd`/`bash` returned "File not found" | Added `resolveExecutable()` that walks `PATH × PATHEXT` on `process.platform === "win32"`, no-op elsewhere; called from `startSession` before `spawn` |
| `extensions/tui-bridge/src/inbound-claim.test.ts` + `src/process-pool.smoke.test.ts` | Hardcoded `/usr/bin/cat`, `/usr/bin/echo`, `/bin/sh -c "exit 0"` — Unix-only | Replaced with `process.execPath` + `-e "<inline JS>"` for cross-platform; added pid/exit polling for ConPTY's async semantics |
| `scripts/lib/bundled-runtime-deps-stage-state.mjs` | Atomic `renameSync` of staging dirs intermittently fails with `EPERM`/`EBUSY` on Windows during the `pnpm build` step (Defender / indexer locking) | Wrapped both renames in a 10× retry-with-backoff on `EPERM|EBUSY|ENOTEMPTY|EACCES` |

## 3. Tests added (all passing)

5 test files, 44 cases, **all green** with no unhandled errors:

| File | Cases | Covers |
|---|---|---|
| `process-pool.smoke.test.ts` | 2 | PTY spawn → settle → readReply → stop |
| `inbound-claim.test.ts` | 6 | hook contract: bound, unbound, unauthorized, no-sessionKey, respawn, exit |
| `drive-bash.smoke.test.ts` | 3 | full `/tui start <bash>` → `pwd` → `/tui stop` |
| `commands.integration.test.ts` | 11 | command surface integration (already existed; un-tracked file got staged) |
| `full-coverage.test.ts` | 22 | resolver edge cases, all slash commands, allowedCommands gate, multi-step interaction, restart, allowlist drop, no-binding bypass |

To re-run on the new device:
```
node node_modules/vitest/vitest.mjs run extensions/tui-bridge --no-coverage
```

(Use the direct vitest entry — `pnpm openclaw <cmd>` triggers a tsdown rebuild that
can clobber `dist-runtime/*` files held open by a running gateway.)

---

## 4. Live system state at end of session

Everything below lives **outside the repo** (in the user's home dir or running processes).
Not committed, but reproducible from notes here.

### 4.1 Config file location

The active config has migrated to the new branding location:
`C:\Users\Wong\.openclaw\openclaw.json`

The previous `C:\Users\Wong\.clawdbot\clawdbot.json` is now stale.

### 4.2 Telegram bot

- Bot username: `@chichongpc_bot` (link: `t.me/chichongpc_bot`)
- Bot was created in this session via `@BotFather`.
- Token stored in `channels.telegram.botToken` of the active config. **Do not paste
  the token in any committed file.** If rotation is needed: BotFather → `/revoke`.
- `dmPolicy: "allowlist"`, `allowFrom: ["255433743"]`
- `commands.ownerAllowFrom: ["telegram:255433743"]`
- Telegram outbound delivery verified in this session: 7+ `sendMessage ok` events
  (message IDs 23, 25, 27, 29, 31, 33, 35, … 64). Inbound polling confirmed working.

User Telegram numeric ID: **`255433743`**.

### 4.3 Plugin binding pre-approval

File: `C:\Users\Wong\.openclaw\plugin-binding-approvals.json`

```json
{
  "version": 1,
  "approvals": [
    {
      "pluginRoot": "D:\\Developments\\tslib\\opencli\\dist-runtime\\extensions\\tui-bridge",
      "pluginId": "tui-bridge",
      "pluginName": "TUI Bridge",
      "channel": "telegram",
      "accountId": "default",
      "approvedAt": 1714451000000
    }
  ]
}
```

This auto-approves any future `/tui start ...` from `@chichongpc_bot` so the user
never sees the "Plugin bind approval required" prompt again.

The next `/tui start cmd` after gateway restart should bind silently.

### 4.4 Open question at end of session

User reported the LLM auth-failure message ("Model login failed for openai-codex")
keeps appearing on every `dir`. Diagnosis:

- The user has not retried `/tui start cmd` since the pre-approval file was added.
- Without an active binding, plain `dir` falls through to the agent path → openai-codex
  OAuth → refresh token has been used (`refresh_token_reused`) → fails.
- Fix is to do `/tui start cmd` **once** in Telegram so the binding gets created.
  After that, the LLM is bypassed entirely (verified in `full-coverage.test.ts`).

The user's pivot to "strip all LLM" supersedes this — see §6.

### 4.5 Known noise (not fixable in scope)

- WhatsApp 401 reconnect loop in the gateway logs — the WhatsApp session expired.
  Re-login via `pnpm openclaw channels login` if WhatsApp is wanted; otherwise disable
  the channel.
- `bonjour` advertises the gateway with a `(2)` suffix because another OpenClaw lives
  somewhere on the LAN. Cosmetic.
- `Telegram menu text exceeded the conservative 5700-character payload budget;
  shortening descriptions to keep 56 commands visible.` — comes from the unstripped
  full-fat OpenClaw build. After §6's strip, most of those go away.

---

## 5. How the LLM is bypassed today (and why §6 is mostly cleanup)

The flow when a Telegram DM "dir" arrives, AFTER tui-bridge is bound:

```
inbound text "dir"
  │
  ▼ slash-command match? — no
  ▼ inbound_claim hooks? — tui-bridge reads ctx.pluginBinding, finds binding
                           → writes "dir\n" to bound PTY's stdin
                           → returns { handled: true, reply: <captured stdout> }
  ◄── short-circuits here. Agent path is never reached.
  ▼ (would have been: agent → openai-codex → … but never happens)
```

So in the bound state, the bot **does not consume any LLM API**. The agent
auth/credential code is loaded but never invoked.

Code reference: `extensions/tui-bridge/src/inbound-claim.ts:17` — `if (!data) return undefined;`
returns a no-claim only when no binding; otherwise short-circuits.

---

## 6. NEW DIRECTION (the user's last instruction before this log)

> "MAJOR change: strip all api related llm from this repo / I'll branch/split/unfork
> from upstream/main repo. I just want human → msg app → pc → tui-bridge →
> controlling many tui. make available `pnpm opencli chat --message ""` (means
> non-interactive) execute & exit returning result for me. btw change the split
> to opencli, not opencraw any more"

Concrete tasks for the next session:

### 6.1 Rebrand `openclaw` → `opencli`

- The repo is already named `opencli` (https://github.com/missbjs/opencli) but the
  package is still `"name": "openclaw"` in `package.json` and many files reference
  `openclaw`/`OpenClaw`/`OPENCLAW_*` env vars/`.openclaw/` config dir.
- Pick: rename everything user-facing to `opencli` / `OpenCLI`, OR keep internal
  module names and only rename CLI binary + brand strings. Latter is much smaller
  blast radius — recommended start.
- Config dir: `~/.openclaw/` → `~/.opencli/` is a migration; suggest leaving the
  read-existing-and-write-new compat shim that's already in place for `~/.clawdbot/`
  as a model.

### 6.2 Strip LLM/agent/API code

The point is: tui-bridge doesn't need ANY of:
- provider plugins (`extensions/{anthropic, openai, openai-codex, ...}/`)
- model fallback / routing
- OAuth / token refresh / model auth
- agent runtime, agent harness, ACP, codex-app-server
- streaming / preview / reasoning
- prompt caching, context, memory, embeddings
- replay, exec approvals (when no LLM is involved)
- TTS / speech / media-understanding plugins

Keep:
- gateway HTTP/WS server (the "msg system" the user wants to reuse)
- plugin runtime + manifest loader
- channel adapters (Telegram, WhatsApp, Discord, Slack, …)
- conversation binding system
- plugin command dispatcher
- inbound_claim hook
- tui-bridge itself

Suggested approach:
1. **Inventory pass first.** `rg -l 'anthropic|openai|model|agent|codex'` in `src/`
   and tag each file as keep / strip / refactor. Don't delete blind.
2. Identify the "spine" that must stay: gateway server, channels registry, plugin
   loader, command dispatcher, inbound-claim hook chain. That's ~10% of `src/`.
3. The provider plugin extensions can be deleted wholesale once nothing references
   them. Channel plugins must stay.
4. Several "shared" modules pull in agent types — those get either inlined
   (tui-bridge-only types) or have the agent-shaped surface stubbed.
5. `agents.defaults.model` config keys disappear from the schema.
6. `commands` slash-command registry stays — it's how `/tui` is dispatched. But
   the agent-fallback path on no-claim returns a plain "no handler" message
   instead of "Model login failed".

### 6.3 Make `pnpm opencli chat --message "..."` non-interactive

Today: `chat` = `tui --local` opens a full-screen blessed/ink-style TUI client.
`--message` only seeds an initial input.

Wanted: `chat --message "<text>" --json` (or similar) should:
1. Connect to the running gateway (or spin up local runtime) once.
2. Send the message through the same dispatch chain as a real channel inbound.
3. Wait for the reply to settle.
4. Print the reply to stdout (text, or JSON if `--json`).
5. Exit with code 0 on success, non-zero on dispatch error.

Implementation sketch:
- New non-interactive code path inside `src/cli/program/register.tui.ts` (or wherever
  `chat` is registered) gated by `--message` + a new `--no-interactive` (or auto-detect:
  if `--message` is set AND stdin is a non-TTY, run non-interactive).
- Reuse the existing `agent --to ... --message ... --deliver` plumbing — that one is
  ALREADY non-interactive. Skim `src/cli/program/register.agent.ts` for the pattern.
- For tui-bridge specifically, the test driver in `extensions/tui-bridge/src/drive-bash.smoke.test.ts`
  is essentially the non-interactive flow. Generalise it.

### 6.4 Order of operations recommendation

Do **6.3 first** — adding a non-interactive `chat` is small, doesn't depend on the
strip, and gives you a fast iteration loop. Then **6.2** the LLM strip (largest
diff, but the test suite is already in place to catch regressions in tui-bridge).
**6.1** rebrand last — purely textual, biggest risk of merge friction with upstream
if you ever re-sync.

---

## 7. Repo state at session end

```
$ git status
On branch main
Your branch is up to date with 'origin/main'.

Untracked files:
  extensions/google/.openclaw-install-stage/    (build artifact, ignore)

$ git log --oneline -5
7a08c0415e dev stage           # ← all this session's code changes
53ee8aeef4 docs(tui-bridge): add v2 push-progress implementation plan
47d9233d6a docs(tui-bridge): add user guide + integration test for inbound-claim hook
44e1463a41 feat(tui-bridge): bundled extension bridging chat to long-lived TUI/CLI processes
80ec402d0f test(sdk): remove redundant fake transport cast
```

This `conversation.md` will be added on top of `7a08c0415e`.

---

## 8. Quick resume checklist for next device

1. `git clone https://github.com/missbjs/opencli && cd opencli && git checkout main`
2. `pnpm install` (Windows: the `EPERM` retry shim is already in
   `scripts/lib/bundled-runtime-deps-stage-state.mjs`)
3. `pnpm build`
4. `pnpm build:plugin-sdk:dts` (only if you'll edit and re-run `node scripts/run-tsgo.mjs`)
5. `node node_modules/vitest/vitest.mjs run extensions/tui-bridge --no-coverage` —
   should print `Test Files 5 passed (5) | Tests 44 passed (44)`.
6. Re-create `~/.opencli/` (or `~/.openclaw/` for now) with the Telegram block + the
   `plugin-binding-approvals.json` shown in §4.3 — paths in that file need to match
   the new device's repo location.
7. `pnpm openclaw gateway` to bring the bot back online.

Or, if jumping straight into §6's pivot, skip 6/7 and start with the inventory grep.
