---
summary: "Run OpenCLI in a rootless Podman container"
read_when:
  - You want a containerized gateway with Podman instead of Docker
title: "Podman"
---

Run the OpenCLI Gateway in a rootless Podman container, managed by your current non-root user.

The intended model is:

- Podman runs the gateway container.
- Your host `opencli` CLI is the control plane.
- Persistent state lives on the host under `~/.opencli` by default.
- Day-to-day management uses `opencli --container <name> ...` instead of `sudo -u opencli`, `podman exec`, or a separate service user.

## Prerequisites

- **Podman** in rootless mode
- **OpenCLI CLI** installed on the host
- **Optional:** `systemd --user` if you want Quadlet-managed auto-start
- **Optional:** `sudo` only if you want `loginctl enable-linger "$(whoami)"` for boot persistence on a headless host

## Quick start

<Steps>
  <Step title="One-time setup">
    From the repo root, run `./scripts/podman/setup.sh`.
  </Step>

  <Step title="Start the Gateway container">
    Start the container with `./scripts/run-opencli-podman.sh launch`.
  </Step>

  <Step title="Run onboarding inside the container">
    Run `./scripts/run-opencli-podman.sh launch setup`, then open `http://127.0.0.1:18789/`.
  </Step>

  <Step title="Manage the running container from the host CLI">
    Set `OPENCLI_CONTAINER=opencli`, then use normal `opencli` commands from the host.
  </Step>
</Steps>

Setup details:

- `./scripts/podman/setup.sh` builds `opencli:local` in your rootless Podman store by default, or uses `OPENCLI_IMAGE` / `OPENCLI_PODMAN_IMAGE` if you set one.
- It creates `~/.opencli/opencli.json` with `gateway.mode: "local"` if missing.
- It creates `~/.opencli/.env` with `OPENCLI_GATEWAY_TOKEN` if missing.
- For manual launches, the helper reads only a small allowlist of Podman-related keys from `~/.opencli/.env` and passes explicit runtime env vars to the container; it does not hand the full env file to Podman.

Quadlet-managed setup:

```bash
./scripts/podman/setup.sh --quadlet
```

Quadlet is a Linux-only option because it depends on systemd user services.

You can also set `OPENCLI_PODMAN_QUADLET=1`.

Optional build/setup env vars:

- `OPENCLI_IMAGE` or `OPENCLI_PODMAN_IMAGE` -- use an existing/pulled image instead of building `opencli:local`
- `OPENCLI_DOCKER_APT_PACKAGES` -- install extra apt packages during image build
- `OPENCLI_EXTENSIONS` -- pre-install plugin dependencies at build time
- `OPENCLI_INSTALL_BROWSER` -- pre-install Chromium and Xvfb for browser automation (set to `1` to enable)

Container start:

```bash
./scripts/run-opencli-podman.sh launch
```

The script starts the container as your current uid/gid with `--userns=keep-id` and bind-mounts your OpenCLI state into the container.

Onboarding:

```bash
./scripts/run-opencli-podman.sh launch setup
```

Then open `http://127.0.0.1:18789/` and use the token from `~/.opencli/.env`.

Host CLI default:

```bash
export OPENCLI_CONTAINER=opencli
```

Then commands such as these will run inside that container automatically:

```bash
opencli dashboard --no-open
opencli gateway status --deep   # includes extra service scan
opencli doctor
opencli channels login
```

On macOS, Podman machine may make the browser appear non-local to the gateway.
If the Control UI reports device-auth errors after launch, use the Tailscale guidance in
[Podman + Tailscale](#podman--tailscale).

<a id="podman--tailscale"></a>

## Podman + Tailscale

For HTTPS or remote browser access, follow the main Tailscale docs.

Podman-specific note:

- Keep the Podman publish host at `127.0.0.1`.
- Prefer host-managed `tailscale serve` over `opencli gateway --tailscale serve`.
- On macOS, if local browser device-auth context is unreliable, use Tailscale access instead of ad hoc local tunnel workarounds.

See:

- [Tailscale](/gateway/tailscale)
- [Control UI](/web/control-ui)

## Systemd (Quadlet, optional)

If you ran `./scripts/podman/setup.sh --quadlet`, setup installs a Quadlet file at:

```bash
~/.config/containers/systemd/opencli.container
```

Useful commands:

- **Start:** `systemctl --user start opencli.service`
- **Stop:** `systemctl --user stop opencli.service`
- **Status:** `systemctl --user status opencli.service`
- **Logs:** `journalctl --user -u opencli.service -f`

After editing the Quadlet file:

```bash
systemctl --user daemon-reload
systemctl --user restart opencli.service
```

For boot persistence on SSH/headless hosts, enable lingering for your current user:

```bash
sudo loginctl enable-linger "$(whoami)"
```

## Config, env, and storage

- **Config dir:** `~/.opencli`
- **Workspace dir:** `~/.opencli/workspace`
- **Token file:** `~/.opencli/.env`
- **Launch helper:** `./scripts/run-opencli-podman.sh`

The launch script and Quadlet bind-mount host state into the container:

- `OPENCLI_CONFIG_DIR` -> `/home/node/.opencli`
- `OPENCLI_WORKSPACE_DIR` -> `/home/node/.opencli/workspace`

By default those are host directories, not anonymous container state, so
`opencli.json`, per-agent `auth-profiles.json`, channel/provider state,
sessions, and workspace survive container replacement.
The Podman setup also seeds `gateway.controlUi.allowedOrigins` for `127.0.0.1` and `localhost` on the published gateway port so the local dashboard works with the container's non-loopback bind.

Useful env vars for the manual launcher:

- `OPENCLI_PODMAN_CONTAINER` -- container name (`opencli` by default)
- `OPENCLI_PODMAN_IMAGE` / `OPENCLI_IMAGE` -- image to run
- `OPENCLI_PODMAN_GATEWAY_HOST_PORT` -- host port mapped to container `18789`
- `OPENCLI_PODMAN_BRIDGE_HOST_PORT` -- host port mapped to container `18790`
- `OPENCLI_PODMAN_PUBLISH_HOST` -- host interface for published ports; default is `127.0.0.1`
- `OPENCLI_GATEWAY_BIND` -- gateway bind mode inside the container; default is `lan`
- `OPENCLI_PODMAN_USERNS` -- `keep-id` (default), `auto`, or `host`

The manual launcher reads `~/.opencli/.env` before finalizing container/image defaults, so you can persist these there.

If you use a non-default `OPENCLI_CONFIG_DIR` or `OPENCLI_WORKSPACE_DIR`, set the same variables for both `./scripts/podman/setup.sh` and later `./scripts/run-opencli-podman.sh launch` commands. The repo-local launcher does not persist custom path overrides across shells.

Quadlet note:

- The generated Quadlet service intentionally keeps a fixed, hardened default shape: `127.0.0.1` published ports, `--bind lan` inside the container, and `keep-id` user namespace.
- It pins `OPENCLI_NO_RESPAWN=1`, `Restart=on-failure`, and `TimeoutStartSec=300`.
- It publishes both `127.0.0.1:18789:18789` (gateway) and `127.0.0.1:18790:18790` (bridge).
- It reads `~/.opencli/.env` as a runtime `EnvironmentFile` for values such as `OPENCLI_GATEWAY_TOKEN`, but it does not consume the manual launcher's Podman-specific override allowlist.
- If you need custom publish ports, publish host, or other container-run flags, use the manual launcher or edit `~/.config/containers/systemd/opencli.container` directly, then reload and restart the service.

## Useful commands

- **Container logs:** `podman logs -f opencli`
- **Stop container:** `podman stop opencli`
- **Remove container:** `podman rm -f opencli`
- **Open dashboard URL from host CLI:** `opencli dashboard --no-open`
- **Health/status via host CLI:** `opencli gateway status --deep` (RPC probe + extra
  service scan)

## Troubleshooting

- **Permission denied (EACCES) on config or workspace:** The container runs with `--userns=keep-id` and `--user <your uid>:<your gid>` by default. Ensure the host config/workspace paths are owned by your current user.
- **Gateway start blocked (missing `gateway.mode=local`):** Ensure `~/.opencli/opencli.json` exists and sets `gateway.mode="local"`. `scripts/podman/setup.sh` creates this if missing.
- **Container CLI commands hit the wrong target:** Use `opencli --container <name> ...` explicitly, or export `OPENCLI_CONTAINER=<name>` in your shell.
- **`opencli update` fails with `--container`:** Expected. Rebuild/pull the image, then restart the container or the Quadlet service.
- **Quadlet service does not start:** Run `systemctl --user daemon-reload`, then `systemctl --user start opencli.service`. On headless systems you may also need `sudo loginctl enable-linger "$(whoami)"`.
- **SELinux blocks bind mounts:** Leave the default mount behavior alone; the launcher auto-adds `:Z` on Linux when SELinux is enforcing or permissive.

## Related

- [Docker](/install/docker)
- [Gateway background process](/gateway/background-process)
- [Gateway troubleshooting](/gateway/troubleshooting)
