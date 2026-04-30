---
summary: "Runbook for the Gateway service, lifecycle, and operations"
read_when:
  - Running or debugging the gateway process
title: "Gateway runbook"
---

Use this page for day-1 startup and day-2 operations of the Gateway service.

<CardGroup cols={2}>
  <Card title="Deep troubleshooting" icon="siren" href="/gateway/troubleshooting">
    Symptom-first diagnostics with exact command ladders and log signatures.
  </Card>
  <Card title="Configuration" icon="sliders" href="/gateway/configuration">
    Task-oriented setup guide + full configuration reference.
  </Card>
  <Card title="Secrets management" icon="key-round" href="/gateway/secrets">
    SecretRef contract, runtime snapshot behavior, and migrate/reload operations.
  </Card>
  <Card title="Secrets plan contract" icon="shield-check" href="/gateway/secrets-plan-contract">
    Exact `secrets apply` target/path rules and ref-only auth-profile behavior.
  </Card>
</CardGroup>

## 5-minute local startup

<Steps>
  <Step title="Start the Gateway">

```bash
opencli gateway --port 18789
# debug/trace mirrored to stdio
opencli gateway --port 18789 --verbose
# force-kill listener on selected port, then start
opencli gateway --force
```

  </Step>

  <Step title="Verify service health">

```bash
opencli gateway status
opencli status
opencli logs --follow
```

Healthy baseline: `Runtime: running`, `Connectivity probe: ok`, and `Capability: ...` that matches what you expect. Use `opencli gateway status --require-rpc` when you need read-scope RPC proof, not just reachability.

  </Step>

  <Step title="Validate channel readiness">

```bash
opencli channels status --probe
```

With a reachable gateway this runs live per-account channel probes and optional audits.
If the gateway is unreachable, the CLI falls back to config-only channel summaries instead
of live probe output.

  </Step>
</Steps>

<Note>
Gateway config reload watches the active config file path (resolved from profile/state defaults, or `OPENCLI_CONFIG_PATH` when set).
Default mode is `gateway.reload.mode="hybrid"`.
After the first successful load, the running process serves the active in-memory config snapshot; successful reload swaps that snapshot atomically.
</Note>

## Runtime model

- One always-on process for routing, control plane, and channel connections.
- Single multiplexed port for:
  - WebSocket control/RPC
  - HTTP APIs, OpenAI compatible (`/v1/models`, `/v1/embeddings`, `/v1/chat/completions`, `/v1/responses`, `/tools/invoke`)
  - Control UI and hooks
- Default bind mode: `loopback`.
- Auth is required by default. Shared-secret setups use
  `gateway.auth.token` / `gateway.auth.password` (or
  `OPENCLI_GATEWAY_TOKEN` / `OPENCLI_GATEWAY_PASSWORD`), and non-loopback
  reverse-proxy setups can use `gateway.auth.mode: "trusted-proxy"`.

## OpenAI-compatible endpoints

OpenCLI’s highest-leverage compatibility surface is now:

- `GET /v1/models`
- `GET /v1/models/{id}`
- `POST /v1/embeddings`
- `POST /v1/chat/completions`
- `POST /v1/responses`

Why this set matters:

- Most Open WebUI, LobeChat, and LibreChat integrations probe `/v1/models` first.
- Many RAG and memory pipelines expect `/v1/embeddings`.
- Agent-native clients increasingly prefer `/v1/responses`.

Planning note:

- `/v1/models` is agent-first: it returns `opencli`, `opencli/default`, and `opencli/<agentId>`.
- `opencli/default` is the stable alias that always maps to the configured default agent.
- Use `x-opencli-model` when you want a backend provider/model override; otherwise the selected agent's normal model and embedding setup stays in control.

All of these run on the main Gateway port and use the same trusted operator auth boundary as the rest of the Gateway HTTP API.

### Port and bind precedence

| Setting      | Resolution order                                             |
| ------------ | ------------------------------------------------------------ |
| Gateway port | `--port` → `OPENCLI_GATEWAY_PORT` → `gateway.port` → `18789` |
| Bind mode    | CLI/override → `gateway.bind` → `loopback`                   |

Installed gateway services record the resolved `--port` in supervisor metadata. After changing `gateway.port`, run `opencli doctor --fix` or `opencli gateway install --force` so launchd/systemd/schtasks starts the process on the new port.

Gateway startup uses the same effective port and bind when it seeds local
Control UI origins for non-loopback binds. For example, `--bind lan --port 3000`
seeds `http://localhost:3000` and `http://127.0.0.1:3000` before runtime
validation runs. Add any remote browser origins, such as HTTPS proxy URLs, to
`gateway.controlUi.allowedOrigins` explicitly.

### Hot reload modes

| `gateway.reload.mode` | Behavior                                   |
| --------------------- | ------------------------------------------ |
| `off`                 | No config reload                           |
| `hot`                 | Apply only hot-safe changes                |
| `restart`             | Restart on reload-required changes         |
| `hybrid` (default)    | Hot-apply when safe, restart when required |

## Operator command set

```bash
opencli gateway status
opencli gateway status --deep   # adds a system-level service scan
opencli gateway status --json
opencli gateway install
opencli gateway restart
opencli gateway stop
opencli secrets reload
opencli logs --follow
opencli doctor
```

`gateway status --deep` is for extra service discovery (LaunchDaemons/systemd system
units/schtasks), not a deeper RPC health probe.

## Multiple gateways (same host)

Most installs should run one gateway per machine. A single gateway can host multiple
agents and channels.

You only need multiple gateways when you intentionally want isolation or a rescue bot.

Useful checks:

```bash
opencli gateway status --deep
opencli gateway probe
```

What to expect:

- `gateway status --deep` can report `Other gateway-like services detected (best effort)`
  and print cleanup hints when stale launchd/systemd/schtasks installs are still around.
- `gateway probe` can warn about `multiple reachable gateways` when more than one target
  answers.
- If that is intentional, isolate ports, config/state, and workspace roots per gateway.

Checklist per instance:

- Unique `gateway.port`
- Unique `OPENCLI_CONFIG_PATH`
- Unique `OPENCLI_STATE_DIR`
- Unique `agents.defaults.workspace`

Example:

```bash
OPENCLI_CONFIG_PATH=~/.opencli/a.json OPENCLI_STATE_DIR=~/.opencli-a opencli gateway --port 19001
OPENCLI_CONFIG_PATH=~/.opencli/b.json OPENCLI_STATE_DIR=~/.opencli-b opencli gateway --port 19002
```

Detailed setup: [/gateway/multiple-gateways](/gateway/multiple-gateways).

## VoiceClaw real-time brain endpoint

OpenCLI exposes a VoiceClaw-compatible real-time WebSocket endpoint at
`/voiceclaw/realtime`. Use it when a VoiceClaw desktop client should talk
directly to a real-time OpenCLI brain instead of going through a separate relay
process.

The endpoint uses Gemini Live for real-time audio and calls OpenCLI as the
brain by exposing OpenCLI tools directly to Gemini Live. Tool calls return an
immediate `working` result to keep the voice turn responsive, then OpenCLI
executes the actual tool asynchronously and injects the result back into the
live session. Set `GEMINI_API_KEY` in the gateway process environment. If
gateway auth is enabled, the desktop client sends the gateway token or password
in its first `session.config` message.

Real-time brain access runs owner-authorized OpenCLI agent commands. Keep
`gateway.auth.mode: "none"` limited to loopback-only test instances. Non-local
real-time brain connections require gateway auth.

For an isolated test gateway, run a separate instance with its own port, config,
and state:

```bash
OPENCLI_CONFIG_PATH=/path/to/opencli-realtime/opencli.json \
OPENCLI_STATE_DIR=/path/to/opencli-realtime/state \
OPENCLI_SKIP_CHANNELS=1 \
GEMINI_API_KEY=... \
opencli gateway --port 19789
```

Then configure VoiceClaw to use:

```text
ws://127.0.0.1:19789/voiceclaw/realtime
```

## Remote access

Preferred: Tailscale/VPN.
Fallback: SSH tunnel.

```bash
ssh -N -L 18789:127.0.0.1:18789 user@host
```

Then connect clients locally to `ws://127.0.0.1:18789`.

<Warning>
SSH tunnels do not bypass gateway auth. For shared-secret auth, clients still
must send `token`/`password` even over the tunnel. For identity-bearing modes,
the request still has to satisfy that auth path.
</Warning>

See: [Remote Gateway](/gateway/remote), [Authentication](/gateway/authentication), [Tailscale](/gateway/tailscale).

## Supervision and service lifecycle

Use supervised runs for production-like reliability.

<Tabs>
  <Tab title="macOS (launchd)">

```bash
opencli gateway install
opencli gateway status
opencli gateway restart
opencli gateway stop
```

Use `opencli gateway restart` for restarts. Do not chain `opencli gateway stop` and `opencli gateway start`; on macOS, `gateway stop` intentionally disables the LaunchAgent before stopping it.

LaunchAgent labels are `ai.opencli.gateway` (default) or `ai.opencli.<profile>` (named profile). `opencli doctor` audits and repairs service config drift.

  </Tab>

  <Tab title="Linux (systemd user)">

```bash
opencli gateway install
systemctl --user enable --now opencli-gateway[-<profile>].service
opencli gateway status
```

For persistence after logout, enable lingering:

```bash
sudo loginctl enable-linger <user>
```

Manual user-unit example when you need a custom install path:

```ini
[Unit]
Description=OpenCLI Gateway
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/local/bin/opencli gateway --port 18789
Restart=always
RestartSec=5
TimeoutStopSec=30
TimeoutStartSec=30
SuccessExitStatus=0 143
KillMode=control-group

[Install]
WantedBy=default.target
```

  </Tab>

  <Tab title="Windows (native)">

```powershell
opencli gateway install
opencli gateway status --json
opencli gateway restart
opencli gateway stop
```

Native Windows managed startup uses a Scheduled Task named `OpenCLI Gateway`
(or `OpenCLI Gateway (<profile>)` for named profiles). If Scheduled Task
creation is denied, OpenCLI falls back to a per-user Startup-folder launcher
that points at `gateway.cmd` inside the state directory.

  </Tab>

  <Tab title="Linux (system service)">

Use a system unit for multi-user/always-on hosts.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now opencli-gateway[-<profile>].service
```

Use the same service body as the user unit, but install it under
`/etc/systemd/system/opencli-gateway[-<profile>].service` and adjust
`ExecStart=` if your `opencli` binary lives elsewhere.

Do not also let `opencli doctor --fix` install a user-level gateway service for the same profile/port. Doctor refuses that automatic install when it finds a system-level OpenCLI gateway service; use `OPENCLI_SERVICE_REPAIR_POLICY=external` when the system unit owns the lifecycle.

  </Tab>
</Tabs>

## Dev profile quick path

```bash
opencli --dev setup
opencli --dev gateway --allow-unconfigured
opencli --dev status
```

Defaults include isolated state/config and base gateway port `19001`.

## Protocol quick reference (operator view)

- First client frame must be `connect`.
- Gateway returns `hello-ok` snapshot (`presence`, `health`, `stateVersion`, `uptimeMs`, limits/policy).
- `hello-ok.features.methods` / `events` are a conservative discovery list, not
  a generated dump of every callable helper route.
- Requests: `req(method, params)` → `res(ok/payload|error)`.
- Common events include `connect.challenge`, `agent`, `chat`,
  `session.message`, `session.tool`, `sessions.changed`, `presence`, `tick`,
  `health`, `heartbeat`, pairing/approval lifecycle events, and `shutdown`.

Agent runs are two-stage:

1. Immediate accepted ack (`status:"accepted"`)
2. Final completion response (`status:"ok"|"error"`), with streamed `agent` events in between.

See full protocol docs: [Gateway Protocol](/gateway/protocol).

## Operational checks

### Liveness

- Open WS and send `connect`.
- Expect `hello-ok` response with snapshot.

### Readiness

```bash
opencli gateway status
opencli channels status --probe
opencli health
```

### Gap recovery

Events are not replayed. On sequence gaps, refresh state (`health`, `system-presence`) before continuing.

## Common failure signatures

| Signature                                                      | Likely issue                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `refusing to bind gateway ... without auth`                    | Non-loopback bind without a valid gateway auth path                             |
| `another gateway instance is already listening` / `EADDRINUSE` | Port conflict                                                                   |
| `Gateway start blocked: set gateway.mode=local`                | Config set to remote mode, or local-mode stamp is missing from a damaged config |
| `unauthorized` during connect                                  | Auth mismatch between client and gateway                                        |

For full diagnosis ladders, use [Gateway Troubleshooting](/gateway/troubleshooting).

## Safety guarantees

- Gateway protocol clients fail fast when Gateway is unavailable (no implicit direct-channel fallback).
- Invalid/non-connect first frames are rejected and closed.
- Graceful shutdown emits `shutdown` event before socket close.

---

Related:

- [Troubleshooting](/gateway/troubleshooting)
- [Background Process](/gateway/background-process)
- [Configuration](/gateway/configuration)
- [Health](/gateway/health)
- [Doctor](/gateway/doctor)
- [Authentication](/gateway/authentication)

## Related

- [Configuration](/gateway/configuration)
- [Gateway troubleshooting](/gateway/troubleshooting)
- [Remote access](/gateway/remote)
- [Secrets management](/gateway/secrets)
