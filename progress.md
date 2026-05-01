# opencli fork — progress and roadmap

Goal: fork `openclaw` → `opencli` and strip all LLM/agent/API code so the gateway is a pure pipe:
`human → msg app (Telegram/chat) → pc → tui-bridge plugin → controlling many tui (PTY)`.

The PTY process (e.g. claude-code CLI) IS the AI. Gateway never calls a model.

## Done (committed)

| Commit     | Phase | Summary                                                                                                                   |
| ---------- | ----- | ------------------------------------------------------------------------------------------------------------------------- |
| `81671949` | §6.2a | refactor(dispatch): sever agent fallback, return static no-handler reply — `src/auto-reply/reply/dispatch-from-config.ts` |
| `982e5bb9` | §6.2b | chore(dispatch): drop unused imports/locals after agent sever                                                             |
| `5eaf18ec` | §6.1a | refactor(rebrand): rename package to opencli, drop "AI gateway" framing                                                   |
| `b9dc8919` | docs  | session log update — §6.3 + §6.2 + §6.1 + cleanup landed                                                                  |
| `602fc87b` | §6.1b | chore(rebrand): full sweep openclaw → opencli (8769 files + 120+ plugin manifests + top-level renames)                    |

§6.3 once-mode capture (`src/tui/tui.ts` Proxy + `onRunTerminated` covering all 5 terminal branches) — 8/8 unit tests green.
§6.2 dispatch sever — 30/30 dispatch tests green; 50 obsolete agent-streaming tests deleted.
§6.1 rebrand — `pnpm opencli --help` and `pnpm opencli gateway --help` both work; CLI shows "🦞 OpenCLI 2026.4.27".

## In progress (uncommitted)

Steps 1–4 (partial) complete. Pending commit.

**Step 1** — `src/tui/embedded-backend.ts` rerouted through `dispatchInboundMessage`. Tests rewritten to mock `dispatchInboundMessage` + `createReplyDispatcher`. Typecheck clean. (vitest hangs in PRoot — trust tsc; defer runner to real host.)

**Step 2** — `src/gateway/server-node-events.ts` voice transcript + `agent.request` handlers replaced with `dispatchInboundMessage` + `MsgContext`. Tests updated. `server-node-events.runtime.ts` re-exports swapped.

**Step 3** — tui-bridge `inbound_claim` confirmed: no channel filter, fires for any surface including `INTERNAL_MESSAGE_CHANNEL`. No widening needed.

**Step 4 (partial)** — ~75 LLM provider extension directories deleted. `src/agents/` deferred (140+ importers in `src/`; requires careful surgery). `get-reply-from-config.runtime.ts` chain deferred (same entanglement). `package.json` dep trim deferred (needs `src/agents/` gone first).

**Typecheck:** `pnpm exec tsc --noEmit` — zero errors in changed files. Pre-existing errors only in `src/agents/` tests and `ui/src/` (unrelated).

## Roadmap

### Step 4 (continued) — finish stripping dead LLM code

- [ ] Delete `src/agents/` — requires audit of which files are truly unreachable vs still imported by non-agent `src/` code. Many files (e.g. `agent-command.ts`) are referenced only from tests; others underlie `getReplyFromConfig` chain. Approach: delete leaf files first, fix importers, repeat.
- [ ] Delete `src/auto-reply/reply/get-reply-from-config.runtime.ts` and its callers once `src/agents/` is gone.
- [ ] Trim `package.json` deps (`openai`, `@mariozechner/pi-*`, etc.) once nothing imports them.
- [ ] Remove ACP runtime if nothing inbound or chat uses it.

### Step 5 — landing checks

- [ ] `pnpm check:changed` (Testbox if available, else local).
- [ ] `pnpm test` full suite (must run on real Linux/macOS host — PRoot event-loop blocks cause vitest to hang).
- [ ] `pnpm build`.

## Architectural notes (for future-me)

**Two paths existed in this repo:**

- **Inbound (channels):** Telegram/Discord/Slack → `dispatchInboundMessage` → `dispatchReplyFromConfig` (severed in §6.2).
- **Chat command:** CLI / EmbeddedTuiBackend / gateway WS `chat.send` → `agentCommandFromIngress` → `agentCommandInternal` (heavy: model catalog, ACP, skills snapshots).

§6.2 only fixed the inbound path. The chat path was discovered to bypass dispatch entirely (verified by `grep -n "dispatch\|getReply\|loadReplyRuntime" src/agents/agent-command.ts` returning nothing).

The user's vision requires **both** paths to flow through `dispatchInboundMessage` so plugins (tui-bridge) can claim. Step 1 + Step 2 are about fixing that.

**MsgContext minimal fields needed for dispatch:** Body, BodyForAgent, BodyForCommands, RawBody, CommandBody, SessionKey, Provider=INTERNAL_MESSAGE_CHANNEL, Surface=INTERNAL_MESSAGE_CHANNEL, ChatType="direct", CommandAuthorized=true, MessageSid (= runId), GatewayClientScopes=[]. All other MsgContext fields are optional.

**ReplyDispatcher capture pattern:** webchat (`src/gateway/server-methods/chat.ts:2284`) uses `createReplyDispatcher({ deliver: async (payload, info) => { if (info.kind === "final" || "block") deliveredReplies.push(payload) } })` then awaits `dispatchInboundMessage` — model this.

## Environment caveat

PRoot sandbox shows `eventLoopDelayMaxMs=82812.3` (82s blocks) on gateway start; plugin runtime staging fails with `EINVAL` on cross-fs hardlinks (`browser`, `memory-core` plugins). Runtime smoke tests (gateway start + chat send) hang for env reasons regardless of code correctness. Trust unit tests; defer integration proof to a real Linux/macOS host or Testbox.

## Files to look at when resuming

- `src/tui/embedded-backend.ts` — current uncommitted change
- `src/tui/embedded-backend.test.ts` — 3 broken tests to rewrite
- `src/auto-reply/dispatch.ts` — `dispatchInboundMessage` entry point
- `src/auto-reply/reply/reply-dispatcher.ts` — `createReplyDispatcher`
- `src/auto-reply/reply/dispatch-from-config.ts:800-828` — §6.2 sever block
- `src/gateway/server-methods/chat.ts:2105-2352` — webchat reference impl
- `src/gateway/server-node-events.ts:408,579` — gateway chat.send (still uses agent path)
- `src/agents/agent-command.ts` — to delete in Step 4
- `extensions/tui-bridge/` — verify claim filter in Step 3
- `conversation.md` — full session history (large)

## Memory pointers (`/root/.claude/projects/-root-projects-opencli/memory/`)

- `user_role.md` — fork goal and user style
- `project_chat_two_paths.md` — the two-path architectural finding
- `feedback_proot_runtime_tests.md` — why local smoke tests are unreliable
