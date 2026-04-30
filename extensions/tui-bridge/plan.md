# TUI Bridge — v2 Push Progress Plan

Self-contained design + implementation plan for adding async progress push to
the `tui-bridge` extension. Designed so you can pick up on a different machine,
read this file, and continue without context.

---

## 1. Goal

Today (v1) the bridge only flushes output to chat in response to an inbound
chat message. If the bound TUI emits work _between_ messages — e.g. an LLM
client like `claude` printing `⏺ Searching codebase…` updates every second
while it thinks — the user sees nothing until they send another message or
type `/tui peek`.

v2 adds a **per-session output watcher** that proactively pushes progress to
chat with these properties:

- Edit-streams a single "progress" message every N seconds (configurable; 30s
  default), so 50fps spinner redraws don't spam the channel.
- After the PTY goes silent for >M seconds (configurable; 10s default),
  treat that as "done" — emit a final message.
- When the channel rejects an edit because of a rate limit, fall back per
  config:
  - `wait-finish` (default, conservative): stop pushing previews this round;
    let idle-finalize do the talking.
  - `new-message`: post a fresh progress message and continue editing that one.
- Watcher is gated by config and per-session slash commands so users can
  start/stop it on the fly.

---

## 2. What exists today (v1, currently shipped)

- `extensions/tui-bridge/src/process-pool.ts` — global session registry, PTY
  spawn via `@lydell/node-pty`, `txt`/`tui` buffers, `waitForSettle`,
  `readReply`. Stable.
- `inbound-claim.ts` — claims chat messages on bound conversations, writes
  text+`\n` to stdin, awaits settle, returns one chat reply.
- `commands.ts` — slash commands: `start | stop | restart | list | mode |
peek | send | sendln | status`.
- Tests: `process-pool.smoke.test.ts` (2 cases), `inbound-claim.test.ts`
  (6 cases). All passing.
- Doc: `tui-bridge.md`.

v1 is **request-driven, not push-driven**. v2 makes the push path additive
without breaking the request-driven path.

---

## 3. Open questions to resolve BEFORE implementation

### 3.1 Outbound channel-message API (BLOCKING)

The watcher needs to send and edit chat messages from outside an
`inbound_claim` handler — i.e. driven by a timer, not a request. We do not
yet know how openclaw exposes this to plugins.

**Investigate:**

```bash
# look for outbound message APIs reachable from a non-channel plugin
grep -rn "sendMessage\|editMessage\|postMessage\|sendChannelMessage" src/plugin-sdk/
grep -rn "outbound\|outgoing" src/plugin-sdk/
# does the channel runtime expose anything like a Pusher to plugin api objects?
grep -rn "channelRuntime\|channelHandle" src/plugin-sdk/ src/channels/
```

Three outcomes:

| Outcome                            | Action                                                                                                                              |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Public API already exists          | Use it directly in `attachWatcher`'s `ChannelPusher`                                                                                |
| Internal-only — needs new SDK seam | Add a typed export per `extensions/CLAUDE.md` boundary rules ("add a typed Plugin SDK subpath… backwards-compatible and versioned") |
| Doesn't exist                      | Larger v2 — design the new SDK contract first, ship that as v2.0, push features land in v2.1                                        |

**Until this is resolved, the rest of the plan is on paper only.**

### 3.2 Per-channel edit support / rate limits

Per-channel capability table needed:

| Channel                | canEdit                | edit rate cap        | post rate cap                  |
| ---------------------- | ---------------------- | -------------------- | ------------------------------ |
| Telegram               | yes                    | 20 edits/min/message | 1 msg/sec/chat, 30 msg/sec/bot |
| Discord                | yes                    | 5 edits/5s/message   | 5 msg/5s/channel               |
| Slack                  | yes                    | tier-based           | tier-based                     |
| Matrix                 | yes                    | none documented      | none documented                |
| WhatsApp               | varies by client       | ??                   | ??                             |
| iMessage (Bluebubbles) | no (treat as new-only) | —                    | —                              |
| SMS / email            | no                     | —                    | —                              |

Confirm the per-channel reality by reading each `extensions/<channel>/` and
matching against the rates in their public docs.

### 3.3 Settle vs watcher race

When a chat message arrives, the existing `inbound-claim` flow writes stdin
and calls `waitForSettle` for `settleMaxMs` (default 30s). During that
window the watcher must NOT also push, or the user gets two replies.

Decision: `inbound-claim.ts` calls `suppressPreviewWindow(sessionKey,
settleMaxMs)` before `writeStdin`. The watcher's preview tick checks
`Date.now() < suppressUntil` and reschedules itself instead of pushing.
The idle-finalize timer is also suppressed during that window — when settle
returns, both timers reset from the next `pty.onData`.

---

## 4. Design

### 4.1 New module: `extensions/tui-bridge/src/output-watcher.ts`

Channel-agnostic. Caller injects the actual send/edit calls via a
`ChannelPusher` interface.

```ts
export type WatcherConfig = {
  enabled: boolean;
  previewEditMs: number; // 30000 default
  idleFinalizeMs: number; // 10000 default
  rateLimitFallback: "new-message" | "wait-finish";
  maxPreviewMessagesPerRound: number; // safety cap, 5 default
  continuous: boolean; // if true, never wait-on-idle; keep editing
  // until /tui progress stop. default false.
};

export type ChannelPusher = {
  capability: { canEdit: boolean };
  sendNew: (text: string) => Promise<{ messageId: string }>;
  edit: (
    messageId: string,
    text: string,
  ) => Promise<{ ok: true } | { ok: false; rateLimited: boolean }>;
};

type WatcherState = {
  sessionKey: string;
  cfg: WatcherConfig;
  pusher: ChannelPusher;
  lastDataAt: number;
  previewTimer?: NodeJS.Timeout;
  idleTimer?: NodeJS.Timeout;
  activePreviewMessageId?: string;
  previewMessagesPosted: number;
  lastSnapshotHash?: string;
  lastPushedAt: number;
  suppressUntil?: number;
  rateLimitTripped: boolean;
};

const watchers = new Map<string, WatcherState>();

export function attachWatcher(session: Session, pusher: ChannelPusher, cfg: WatcherConfig): void;

export function detachWatcher(sessionKey: string): void;

export function suppressPreviewWindow(sessionKey: string, ms: number): void;

export function updateWatcherConfig(sessionKey: string, patch: Partial<WatcherConfig>): void;

export function getWatcherStatus(sessionKey: string):
  | {
      attached: boolean;
      enabled: boolean;
      cfg?: WatcherConfig;
      previewMessagesPosted?: number;
      rateLimitTripped?: boolean;
      lastPushedAt?: number;
    }
  | undefined;
```

Core flow (pseudocode for the timer logic):

```
on pty.onData(d):
  state.lastDataAt = now
  resetTimers()

resetTimers():
  clear preview + idle timers
  if !rateLimitTripped and previewEditMs > 0:
    schedule preview tick at +previewEditMs
  schedule idle-finalize at +idleFinalizeMs

preview tick:
  if now < suppressUntil: reschedule and return
  snap = render(session)        // reuses screen.snapshot or scrubTxt
  hash = cheap-hash(snap)
  if hash == lastSnapshotHash: reschedule and return
  ok = tryPush(snap)            // sendNew or edit per state
  if ok: lastSnapshotHash = hash
  if !rateLimitTripped: reschedule

tryPush(text):
  if !activePreviewMessageId:
    r = pusher.sendNew(text); active = r.messageId; posted = 1; return ok
  if pusher.capability.canEdit:
    r = pusher.edit(active, text)
    if r.ok: return ok
    if r.rateLimited: return handleRateLimit(text)
    return rolloverNew(text)    // edit failed for non-rate reasons
  return rolloverNew(text)

handleRateLimit(text):
  if cfg.rateLimitFallback == "wait-finish":
    rateLimitTripped = true; return false
  return rolloverNew(text)

rolloverNew(text):
  if previewMessagesPosted >= cfg.maxPreviewMessagesPerRound:
    rateLimitTripped = true; return false
  r = pusher.sendNew(text); active = r.messageId; posted += 1; return ok

idle finalize:
  if cfg.continuous: schedule another idle check; do NOT finalize
  finalText = render(session); finalHash = hash(finalText)
  if finalHash != lastSnapshotHash: pusher.sendNew(finalText)
  active = undefined; posted = 0; lastSnapshotHash = undefined
  rateLimitTripped = false
```

Rendering note: the watcher must use a **non-destructive** snapshot (clone the
buffer, run the same `scrubTxt` or `screen.snapshot()` logic, but DO NOT
empty `txtBuffer`/`buffer`). Drainage should still be owned by the
request-driven `readReply` to avoid breaking `inbound-claim`.

### 4.2 Wiring changes to existing files

**`process-pool.ts`** — add optional callbacks on `Session`:

```ts
export type Session = {
  // …existing fields…
  onDataExtra?: (chunk: string) => void;
  onExitExtra?: (info: { code: number | undefined }) => void;
};

// inside startSession's pty.onData handler, after existing buffer work:
session.onDataExtra?.(d);

// inside startSession's pty.onExit handler:
session.onExitExtra?.({ code: exitCode });
```

Also add a non-destructive renderer that the watcher can call:

```ts
export function snapshotReply(session: Session): string;
// like readReply but does NOT clear buffers
```

**`commands.ts`** — `handleStart`, after a successful binding:

```ts
const pusher = ctx.getChannelPusher(); // ← needs §3.1 resolved
attachWatcher(session, pusher, cfg.watcher);
```

`handleStop`:

```ts
detachWatcher(sessionKey);
```

Add the new `progress` subcommand handler (§5).

**`inbound-claim.ts`** — before `writeStdin`:

```ts
suppressPreviewWindow(sessionKey, cfg.settleMaxMs);
```

### 4.3 Config schema additions

`extensions/tui-bridge/openclaw.plugin.json` `configSchema.properties`:

```json
"watcher": {
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "enabled":              { "type": "boolean", "default": false },
    "previewEditMs":        { "type": "number",  "minimum": 1000,  "default": 30000 },
    "idleFinalizeMs":       { "type": "number",  "minimum": 1000,  "default": 10000 },
    "rateLimitFallback":    { "type": "string",  "enum": ["new-message","wait-finish"], "default": "wait-finish" },
    "maxPreviewMessagesPerRound": { "type": "number", "minimum": 1, "default": 5 },
    "continuous":           { "type": "boolean", "default": false }
  }
}
```

`resolveConfig()` in `src/types.ts` extends to merge defaults + validate.

---

## 5. New slash commands

All under `/tui progress …`. Per-conversation; affects only the bound
session's watcher. Persistence: in-memory by default. If the user runs
`/tui progress save` (optional), persist back to the conversation binding's
`data` payload so it survives gateway restart.

| Command                                           | Effect                                                                                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `/tui progress`                                   | Print current watcher status (attached, enabled, rate, mode, preview count, rate-limit state)                                              |
| `/tui progress start`                             | Enable the watcher for this session (sets `watcher.enabled = true`); attaches if not yet attached                                          |
| `/tui progress stop`                              | Disable + detach; cancels timers, no further push                                                                                          |
| `/tui progress continuous on\|off`                | Toggle continuous mode — `on`: never auto-finalize on idle, keep editing forever until stopped; `off`: default behavior with idle-finalize |
| `/tui progress rate <duration>`                   | Set `previewEditMs`. Accepts `<n>ms`, `<n>s`, `<n>m`. Rejects values <1s.                                                                  |
| `/tui progress idle <duration>`                   | Set `idleFinalizeMs` (only meaningful when `continuous: false`)                                                                            |
| `/tui progress fallback new-message\|wait-finish` | Set `rateLimitFallback`                                                                                                                    |
| `/tui progress reset`                             | Restore defaults from plugin config                                                                                                        |

Implementation: extend `commands.ts:handleTuiCommand`'s subcommand switch.
Add a small `parseDuration("30s")` helper. Most commands resolve to
`updateWatcherConfig(sessionKey, patch)` and reply with the new effective
config.

Update `HELP_TEXT` to include these.

Update `tui-bridge.md`'s slash-command table.

---

## 6. Phased rollout

### v2.0 — block-only push, gated dark

- Watcher present, default `enabled: false`.
- Implements only `idleFinalizeMs` path (§4.1's idle finalize; preview tick
  is a no-op when `previewEditMs` is unset or watcher is fresh).
- Validates: outbound API works, settle suppression works, no double-replies.
- Risk: low. No edits, no rate-limit pressure.

### v2.1 — preview edit-streaming

- Adds `previewEditMs`, `rateLimitFallback`, `continuous`.
- Edit-mode where `pusher.capability.canEdit`; new-message fallback otherwise.
- `wait-finish` is the default fallback (conservative).
- Real Telegram + Discord smoke tests required — rate behavior is the
  failure mode that unit tests can't catch.

### v2.2 — smart spinner suppression

- Line-level diff for `lastSnapshotHash` instead of full-string hash.
- Strip lines that contain only spinner glyphs (`|/-\`, `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`,
  trailing whitespace) before hashing.
- Soft-pause if last 3 ticks were no-change (extend interval temporarily).

---

## 7. Test plan

### v2.0 unit tests (no real channel)

`extensions/tui-bridge/src/output-watcher.test.ts`:

- `attachWatcher` is a no-op when `cfg.enabled === false`
- Idle finalize fires once after `idleFinalizeMs` of silence (use fake
  timers)
- `pty.onData` resets the idle timer (no premature finalize during long
  output)
- `suppressPreviewWindow` blocks both timers for the requested duration
- `detachWatcher` cancels all timers and removes from registry
- `stopSession` integration: detaches watcher
- Mock `ChannelPusher` records calls; assert `sendNew` called once with
  the final snapshot text on idle

### v2.1 unit tests

- Preview tick edits the active message until rate-limit hit
- `wait-finish` fallback: after `rateLimited: true`, no further pushes
  this round; idle-finalize still fires
- `new-message` fallback: after rate-limit, posts new message and continues
  editing it
- `maxPreviewMessagesPerRound` cap stops new-message overflow
- Snapshot dedup: identical snapshot doesn't push
- `continuous: true` disables idle-finalize

### v2.x integration smoke (manual, real channel)

- Telegram bot, watcher on, `/tui start claude`, send a long-thinking prompt,
  confirm one progress message edits ~every 30s, finalize message arrives
  ~10s after last spinner update.
- Same on Discord.
- Repeat with `continuous: true`, confirm no finalize.
- Trigger rate-limit by setting `previewEditMs: 1500` for 5 minutes;
  observe fallback behavior in both modes.

---

## 8. Files to create/modify

```
NEW:
  extensions/tui-bridge/src/output-watcher.ts
  extensions/tui-bridge/src/output-watcher.test.ts
  extensions/tui-bridge/src/duration.ts          (parseDuration helper)
  extensions/tui-bridge/src/duration.test.ts

MODIFY:
  extensions/tui-bridge/openclaw.plugin.json     (configSchema.watcher)
  extensions/tui-bridge/src/types.ts             (WatcherConfig, resolveConfig)
  extensions/tui-bridge/src/process-pool.ts      (onDataExtra/onExitExtra hooks, snapshotReply)
  extensions/tui-bridge/src/inbound-claim.ts     (call suppressPreviewWindow)
  extensions/tui-bridge/src/commands.ts          (attach/detach + /tui progress subcommand)
  extensions/tui-bridge/tui-bridge.md            (document new commands + config)
```

---

## 9. How to resume on another machine

1. Clone: `git clone https://github.com/missbjs/opencli.git && cd opencli`
2. Install + baseline check:
   ```
   pnpm install
   pnpm test extensions/tui-bridge
   ```
   8/8 should pass before you change anything.
3. Resolve §3.1 first. Spawn an Explore agent or grep manually:
   ```
   grep -rn "sendMessage\|editMessage\|postMessage" src/plugin-sdk/ | head -50
   ```
   Document findings inline in this file under a new `## 3.1 Findings`
   section before writing code.
4. Implement v2.0 (block-only) end-to-end. Smallest unit of useful change.
   Keep `watcher.enabled: false` in the default schema so it ships dark.
5. Land tests + a v2.0 commit. Push.
6. Move to v2.1 only after a real-channel smoke of v2.0 is green.

---

## 10. Non-goals (defer)

- Per-message threading inside chat (each TUI session = its own thread).
- Markdown / rich formatting of the snapshot. Plain text only in v2.x.
- Channel-side cancellation (user clicks "cancel" on the progress message
  to stop the TUI). Useful but layers a chat-UI concern that's out of
  scope for the bridge plugin.
- Multiple bound TUIs per conversation. v1's "one TUI per session" still
  holds.

---

## 11. References inside this repo

- v1 module being extended: `extensions/tui-bridge/src/process-pool.ts`
- v1 hook: `extensions/tui-bridge/src/inbound-claim.ts`
- Slash-command surface: `extensions/tui-bridge/src/commands.ts`
- Plugin SDK entrypoints (where to add a seam if §3.1 needs one):
  `src/plugin-sdk/plugin-entry.ts`, `scripts/lib/plugin-sdk-entrypoints.json`
- Streaming conventions (do not violate): `docs/concepts/streaming.md`
- Extensions boundary rules: `extensions/CLAUDE.md`
- Existing PTY adapter pattern (mirrors what we do):
  `src/process/supervisor/adapters/pty.ts`
