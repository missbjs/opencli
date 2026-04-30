---
summary: "Updating OpenCLI safely (global install or source), plus rollback strategy"
read_when:
  - Updating OpenCLI
  - Something breaks after an update
title: "Updating"
---

Keep OpenCLI up to date.

## Recommended: `opencli update`

The fastest way to update. It detects your install type (npm or git), fetches the latest version, runs `opencli doctor`, and restarts the gateway.

```bash
opencli update
```

To switch channels or target a specific version:

```bash
opencli update --channel beta
opencli update --channel dev
opencli update --tag main
opencli update --dry-run   # preview without applying
```

`--channel beta` prefers beta, but the runtime falls back to stable/latest when
the beta tag is missing or older than the latest stable release. Use `--tag beta`
if you want the raw npm beta dist-tag for a one-off package update.

See [Development channels](/install/development-channels) for channel semantics.

## Switch between npm and git installs

Use channels when you want to change the install type. The updater keeps your
state, config, credentials, and workspace in `~/.opencli`; it only changes
which OpenCLI code install the CLI and gateway use.

```bash
# npm package install -> editable git checkout
opencli update --channel dev

# git checkout -> npm package install
opencli update --channel stable
```

Run with `--dry-run` first to preview the exact install-mode switch:

```bash
opencli update --channel dev --dry-run
opencli update --channel stable --dry-run
```

The `dev` channel ensures a git checkout, builds it, and installs the global CLI
from that checkout. The `stable` and `beta` channels use package installs. If the
gateway is already installed, `opencli update` refreshes the service metadata
and restarts it unless you pass `--no-restart`.

## Alternative: re-run the installer

```bash
curl -fsSL https://opencli.ai/install.sh | bash
```

Add `--no-onboard` to skip onboarding. To force a specific install type through
the installer, pass `--install-method git --no-onboard` or
`--install-method npm --no-onboard`.

If `opencli update` fails after the npm package install phase, re-run the
installer. The installer does not call the old updater; it runs the global
package install directly and can recover a partially updated npm install.

```bash
curl -fsSL https://opencli.ai/install.sh | bash -s -- --install-method npm
```

To pin the recovery to a specific version or dist-tag, add `--version`:

```bash
curl -fsSL https://opencli.ai/install.sh | bash -s -- --install-method npm --version <version-or-dist-tag>
```

## Alternative: manual npm, pnpm, or bun

```bash
npm i -g opencli@latest
```

When `opencli update` manages a global npm install, it installs the target into
a temporary npm prefix first, verifies the packaged `dist` inventory, then swaps
the clean package tree into the real global prefix. That avoids npm overlaying a
new package onto stale files from the old package. If the install command fails,
OpenCLI retries once with `--omit=optional`. That retry helps hosts where native
optional dependencies cannot compile, while keeping the original failure visible
if the fallback also fails.

```bash
pnpm add -g opencli@latest
```

```bash
bun add -g opencli@latest
```

### Advanced npm install topics

<AccordionGroup>
  <Accordion title="Read-only package tree">
    OpenCLI treats packaged global installs as read-only at runtime, even when the global package directory is writable by the current user. Bundled plugin runtime dependencies are staged into a writable runtime directory instead of mutating the package tree. This keeps `opencli update` from racing with a running gateway or local agent that is repairing plugin dependencies during the same install.

    Some Linux npm setups install global packages under root-owned directories such as `/usr/lib/node_modules/opencli`. OpenCLI supports that layout through the same external staging path.

  </Accordion>
  <Accordion title="Hardened systemd units">
    Set a writable stage directory that is included in `ReadWritePaths`:

    ```ini
    Environment=OPENCLI_PLUGIN_STAGE_DIR=/var/lib/opencli/plugin-runtime-deps
    ReadWritePaths=/var/lib/opencli /home/opencli/.opencli /tmp
    ```

    `OPENCLI_PLUGIN_STAGE_DIR` also accepts a path list. OpenCLI resolves bundled plugin runtime dependencies left-to-right across the listed roots, treats earlier roots as read-only preinstalled layers, and installs or repairs only into the final writable root:

    ```ini
    Environment=OPENCLI_PLUGIN_STAGE_DIR=/opt/opencli/plugin-runtime-deps:/var/lib/opencli/plugin-runtime-deps
    ReadWritePaths=/var/lib/opencli /home/opencli/.opencli /tmp
    ```

    If `OPENCLI_PLUGIN_STAGE_DIR` is not set, OpenCLI uses `$STATE_DIRECTORY` when systemd provides it, then falls back to `~/.opencli/plugin-runtime-deps`. The repair step treats that stage as an OpenCLI-owned local package root and ignores user npm prefix and global settings, so global-install npm config does not redirect bundled plugin dependencies into `~/node_modules` or the global package tree.

  </Accordion>
  <Accordion title="Disk-space preflight">
    Before package updates and bundled runtime-dependency repairs, OpenCLI tries a best-effort disk-space check for the target volume. Low space produces a warning with the checked path, but does not block the update because filesystem quotas, snapshots, and network volumes can change after the check. The actual npm install, copy, and post-install verification remain authoritative.
  </Accordion>
  <Accordion title="Bundled plugin runtime dependencies">
    Packaged installs keep bundled plugin runtime dependencies out of the read-only package tree. On startup and during `opencli doctor --fix`, OpenCLI repairs runtime dependencies only for bundled plugins that are active in config, active through legacy channel config, or enabled by their bundled manifest default. Persisted channel auth state alone does not trigger Gateway startup runtime-dependency repair.

    Explicit disablement wins. A disabled plugin or channel does not get its runtime dependencies repaired just because it exists in the package. External plugins and custom load paths still use `opencli plugins install` or `opencli plugins update`.

  </Accordion>
</AccordionGroup>

## Auto-updater

The auto-updater is off by default. Enable it in `~/.opencli/opencli.json`:

```json5
{
  update: {
    channel: "stable",
    auto: {
      enabled: true,
      stableDelayHours: 6,
      stableJitterHours: 12,
      betaCheckIntervalHours: 1,
    },
  },
}
```

| Channel  | Behavior                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------- |
| `stable` | Waits `stableDelayHours`, then applies with deterministic jitter across `stableJitterHours` (spread rollout). |
| `beta`   | Checks every `betaCheckIntervalHours` (default: hourly) and applies immediately.                              |
| `dev`    | No automatic apply. Use `opencli update` manually.                                                            |

The gateway also logs an update hint on startup (disable with `update.checkOnStart: false`).
For downgrade or incident recovery, set `OPENCLI_NO_AUTO_UPDATE=1` in the gateway environment to block automatic applies even when `update.auto.enabled` is configured. Startup update hints can still run unless `update.checkOnStart` is also disabled.

## After updating

<Steps>

### Run doctor

```bash
opencli doctor
```

Migrates config, audits DM policies, and checks gateway health. Details: [Doctor](/gateway/doctor)

### Restart the gateway

```bash
opencli gateway restart
```

### Verify

```bash
opencli health
```

</Steps>

## Rollback

### Pin a version (npm)

```bash
npm i -g opencli@<version>
opencli doctor
opencli gateway restart
```

<Tip>
`npm view opencli version` shows the current published version.
</Tip>

### Pin a commit (source)

```bash
git fetch origin
git checkout "$(git rev-list -n 1 --before=\"2026-01-01\" origin/main)"
pnpm install && pnpm build
opencli gateway restart
```

To return to latest: `git checkout main && git pull`.

## If you are stuck

- Run `opencli doctor` again and read the output carefully.
- For `opencli update --channel dev` on source checkouts, the updater auto-bootstraps `pnpm` when needed. If you see a pnpm/corepack bootstrap error, install `pnpm` manually (or re-enable `corepack`) and rerun the update.
- Check: [Troubleshooting](/gateway/troubleshooting)
- Ask in Discord: [https://discord.gg/clawd](https://discord.gg/clawd)

## Related

- [Install overview](/install): all installation methods.
- [Doctor](/gateway/doctor): health checks after updates.
- [Migrating](/install/migrating): major version migration guides.
