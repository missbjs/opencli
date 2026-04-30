---
summary: "Uninstall OpenCLI completely (CLI, service, state, workspace)"
read_when:
  - You want to remove OpenCLI from a machine
  - The gateway service is still running after uninstall
title: "Uninstall"
---

Two paths:

- **Easy path** if `opencli` is still installed.
- **Manual service removal** if the CLI is gone but the service is still running.

## Easy path (CLI still installed)

Recommended: use the built-in uninstaller:

```bash
opencli uninstall
```

Non-interactive (automation / npx):

```bash
opencli uninstall --all --yes --non-interactive
npx -y opencli uninstall --all --yes --non-interactive
```

Manual steps (same result):

1. Stop the gateway service:

```bash
opencli gateway stop
```

2. Uninstall the gateway service (launchd/systemd/schtasks):

```bash
opencli gateway uninstall
```

3. Delete state + config:

```bash
rm -rf "${OPENCLI_STATE_DIR:-$HOME/.opencli}"
```

If you set `OPENCLI_CONFIG_PATH` to a custom location outside the state dir, delete that file too.

4. Delete your workspace (optional, removes agent files):

```bash
rm -rf ~/.opencli/workspace
```

5. Remove the CLI install (pick the one you used):

```bash
npm rm -g opencli
pnpm remove -g opencli
bun remove -g opencli
```

6. If you installed the macOS app:

```bash
rm -rf /Applications/OpenCLI.app
```

Notes:

- If you used profiles (`--profile` / `OPENCLI_PROFILE`), repeat step 3 for each state dir (defaults are `~/.opencli-<profile>`).
- In remote mode, the state dir lives on the **gateway host**, so run steps 1-4 there too.

## Manual service removal (CLI not installed)

Use this if the gateway service keeps running but `opencli` is missing.

### macOS (launchd)

Default label is `ai.opencli.gateway` (or `ai.opencli.<profile>`; legacy `com.opencli.*` may still exist):

```bash
launchctl bootout gui/$UID/ai.opencli.gateway
rm -f ~/Library/LaunchAgents/ai.opencli.gateway.plist
```

If you used a profile, replace the label and plist name with `ai.opencli.<profile>`. Remove any legacy `com.opencli.*` plists if present.

### Linux (systemd user unit)

Default unit name is `opencli-gateway.service` (or `opencli-gateway-<profile>.service`):

```bash
systemctl --user disable --now opencli-gateway.service
rm -f ~/.config/systemd/user/opencli-gateway.service
systemctl --user daemon-reload
```

### Windows (Scheduled Task)

Default task name is `OpenCLI Gateway` (or `OpenCLI Gateway (<profile>)`).
The task script lives under your state dir.

```powershell
schtasks /Delete /F /TN "OpenCLI Gateway"
Remove-Item -Force "$env:USERPROFILE\.opencli\gateway.cmd"
```

If you used a profile, delete the matching task name and `~\.opencli-<profile>\gateway.cmd`.

## Normal install vs source checkout

### Normal install (install.sh / npm / pnpm / bun)

If you used `https://opencli.ai/install.sh` or `install.ps1`, the CLI was installed with `npm install -g opencli@latest`.
Remove it with `npm rm -g opencli` (or `pnpm remove -g` / `bun remove -g` if you installed that way).

### Source checkout (git clone)

If you run from a repo checkout (`git clone` + `opencli ...` / `bun run opencli ...`):

1. Uninstall the gateway service **before** deleting the repo (use the easy path above or manual service removal).
2. Delete the repo directory.
3. Remove state + workspace as shown above.

## Related

- [Install overview](/install)
- [Migration guide](/install/migrating)
