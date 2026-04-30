---
summary: "WeChat channel setup through the external opencli-weixin plugin"
read_when:
  - You want to connect OpenCLI to WeChat or Weixin
  - You are installing or troubleshooting the opencli-weixin channel plugin
  - You need to understand how external channel plugins run beside the Gateway
title: "WeChat"
---

OpenCLI connects to WeChat through Tencent's external
`@tencent-weixin/opencli-weixin` channel plugin.

Status: external plugin. Direct chats and media are supported. Group chats are not
advertised by the current plugin capability metadata.

## Naming

- **WeChat** is the user-facing name in these docs.
- **Weixin** is the name used by Tencent's package and by the plugin id.
- `opencli-weixin` is the OpenCLI channel id.
- `@tencent-weixin/opencli-weixin` is the npm package.

Use `opencli-weixin` in CLI commands and config paths.

## How it works

The WeChat code does not live in the OpenCLI core repo. OpenCLI provides the
generic channel plugin contract, and the external plugin provides the
WeChat-specific runtime:

1. `opencli plugins install` installs `@tencent-weixin/opencli-weixin`.
2. The Gateway discovers the plugin manifest and loads the plugin entrypoint.
3. The plugin registers channel id `opencli-weixin`.
4. `opencli channels login --channel opencli-weixin` starts QR login.
5. The plugin stores account credentials under the OpenCLI state directory.
6. When the Gateway starts, the plugin starts its Weixin monitor for each
   configured account.
7. Inbound WeChat messages are normalized through the channel contract, routed to
   the selected OpenCLI agent, and sent back through the plugin outbound path.

That separation matters: OpenCLI core should stay channel-agnostic. WeChat login,
Tencent iLink API calls, media upload/download, context tokens, and account
monitoring are owned by the external plugin.

## Install

Quick install:

```bash
npx -y @tencent-weixin/opencli-weixin-cli install
```

Manual install:

```bash
opencli plugins install "@tencent-weixin/opencli-weixin"
opencli config set plugins.entries.opencli-weixin.enabled true
```

Restart the Gateway after install:

```bash
opencli gateway restart
```

## Login

Run QR login on the same machine that runs the Gateway:

```bash
opencli channels login --channel opencli-weixin
```

Scan the QR code with WeChat on your phone and confirm the login. The plugin saves
the account token locally after a successful scan.

To add another WeChat account, run the same login command again. For multiple
accounts, isolate direct-message sessions by account, channel, and sender:

```bash
opencli config set session.dmScope per-account-channel-peer
```

## Access control

Direct messages use the normal OpenCLI pairing and allowlist model for channel
plugins.

Approve new senders:

```bash
opencli pairing list opencli-weixin
opencli pairing approve opencli-weixin <CODE>
```

For the full access-control model, see [Pairing](/channels/pairing).

## Compatibility

The plugin checks the host OpenCLI version at startup.

| Plugin line | OpenCLI version         | npm tag  |
| ----------- | ----------------------- | -------- |
| `2.x`       | `>=2026.3.22`           | `latest` |
| `1.x`       | `>=2026.1.0 <2026.3.22` | `legacy` |

If the plugin reports that your OpenCLI version is too old, either update
OpenCLI or install the legacy plugin line:

```bash
opencli plugins install @tencent-weixin/opencli-weixin@legacy
```

## Sidecar process

The WeChat plugin can run helper work beside the Gateway while it monitors the
Tencent iLink API. In issue #68451, that helper path exposed a bug in OpenCLI's
generic stale-Gateway cleanup: a child process could try to clean up the parent
Gateway process, causing restart loops under process managers such as systemd.

Current OpenCLI startup cleanup excludes the current process and its ancestors,
so a channel helper must not kill the Gateway that launched it. This fix is
generic; it is not a WeChat-specific path in core.

## Troubleshooting

Check install and status:

```bash
opencli plugins list
opencli channels status --probe
opencli --version
```

If the channel shows as installed but does not connect, confirm that the plugin is
enabled and restart:

```bash
opencli config set plugins.entries.opencli-weixin.enabled true
opencli gateway restart
```

If the Gateway restarts repeatedly after enabling WeChat, update both OpenCLI and
the plugin:

```bash
npm view @tencent-weixin/opencli-weixin version
opencli plugins install "@tencent-weixin/opencli-weixin" --force
opencli gateway restart
```

Temporary disable:

```bash
opencli config set plugins.entries.opencli-weixin.enabled false
opencli gateway restart
```

## Related docs

- Channel overview: [Chat Channels](/channels)
- Pairing: [Pairing](/channels/pairing)
- Channel routing: [Channel Routing](/channels/channel-routing)
- Plugin architecture: [Plugin Architecture](/plugins/architecture)
- Channel plugin SDK: [Channel Plugin SDK](/plugins/sdk-channel-plugins)
- External package: [@tencent-weixin/opencli-weixin](https://www.npmjs.com/package/@tencent-weixin/opencli-weixin)
