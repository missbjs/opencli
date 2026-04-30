---
summary: "CLI reference for `opencli plugins` (list, install, marketplace, uninstall, enable/disable, deps, doctor)"
read_when:
  - You want to install or manage Gateway plugins or compatible bundles
  - You want to debug plugin load failures
title: "Plugins"
sidebarTitle: "Plugins"
---

Manage Gateway plugins, hook packs, and compatible bundles.

<CardGroup cols={2}>
  <Card title="Plugin system" href="/tools/plugin">
    End-user guide for installing, enabling, and troubleshooting plugins.
  </Card>
  <Card title="Plugin bundles" href="/plugins/bundles">
    Bundle compatibility model.
  </Card>
  <Card title="Plugin manifest" href="/plugins/manifest">
    Manifest fields and config schema.
  </Card>
  <Card title="Security" href="/gateway/security">
    Security hardening for plugin installs.
  </Card>
</CardGroup>

## Commands

```bash
opencli plugins list
opencli plugins list --enabled
opencli plugins list --verbose
opencli plugins list --json
opencli plugins install <path-or-spec>
opencli plugins inspect <id>
opencli plugins inspect <id> --json
opencli plugins inspect --all
opencli plugins info <id>
opencli plugins enable <id>
opencli plugins disable <id>
opencli plugins registry
opencli plugins registry --refresh
opencli plugins uninstall <id>
opencli plugins deps
opencli plugins deps --repair
opencli plugins deps --prune
opencli plugins deps --json
opencli plugins doctor
opencli plugins update <id-or-npm-spec>
opencli plugins update --all
opencli plugins marketplace list <marketplace>
opencli plugins marketplace list <marketplace> --json
```

For slow install, inspect, uninstall, or registry-refresh investigation, run the
command with `OPENCLI_PLUGIN_LIFECYCLE_TRACE=1`. The trace writes phase timings
to stderr and keeps JSON output parseable. See [Debugging](/help/debugging#plugin-lifecycle-trace).

<Note>
Bundled plugins ship with OpenCLI. Some are enabled by default (for example bundled model providers, bundled speech providers, and the bundled browser plugin); others require `plugins enable`.

Native OpenCLI plugins must ship `opencli.plugin.json` with an inline JSON Schema (`configSchema`, even if empty). Compatible bundles use their own bundle manifests instead.

`plugins list` shows `Format: opencli` or `Format: bundle`. Verbose list/info output also shows the bundle subtype (`codex`, `claude`, or `cursor`) plus detected bundle capabilities.
</Note>

### Install

```bash
opencli plugins install <package>                      # ClawHub first, then npm
opencli plugins install clawhub:<package>              # ClawHub only
opencli plugins install npm:<package>                  # npm only
opencli plugins install <package> --force              # overwrite existing install
opencli plugins install <package> --pin                # pin version
opencli plugins install <package> --dangerously-force-unsafe-install
opencli plugins install <path>                         # local path
opencli plugins install <plugin>@<marketplace>         # marketplace
opencli plugins install <plugin> --marketplace <name>  # marketplace (explicit)
opencli plugins install <plugin> --marketplace https://github.com/<owner>/<repo>
```

<Warning>
Bare package names are checked against ClawHub first, then npm. Treat plugin installs like running code. Prefer pinned versions.
</Warning>

<Note>
ClawHub is the primary distribution and discovery surface for most plugins. Npm
remains a supported fallback and direct-install path. During the migration to
ClawHub, OpenCLI still ships some OpenCLI-owned `@opencli/*` plugin packages
on npm; those package versions can lag the bundled source between plugin release
trains. If npm reports an OpenCLI-owned plugin package as deprecated, that
published version is an old external artifact; use the plugin bundled with
current OpenCLI or a local checkout until a newer npm package is published.
</Note>

<AccordionGroup>
  <Accordion title="Config includes and invalid-config recovery">
    If your `plugins` section is backed by a single-file `$include`, `plugins install/update/enable/disable/uninstall` write through to that included file and leave `opencli.json` untouched. Root includes, include arrays, and includes with sibling overrides fail closed instead of flattening. See [Config includes](/gateway/configuration) for the supported shapes.

    If config is invalid during install, `plugins install` normally fails closed and tells you to run `opencli doctor --fix` first. During Gateway startup, invalid config for one plugin is isolated to that plugin so other channels and plugins can keep running; `opencli doctor --fix` can quarantine the invalid plugin entry. The only documented install-time exception is a narrow bundled-plugin recovery path for plugins that explicitly opt into `opencli.install.allowInvalidConfigRecovery`.

  </Accordion>
  <Accordion title="--force and reinstall vs update">
    `--force` reuses the existing install target and overwrites an already-installed plugin or hook pack in place. Use it when you are intentionally reinstalling the same id from a new local path, archive, ClawHub package, or npm artifact. For routine upgrades of an already tracked npm plugin, prefer `opencli plugins update <id-or-npm-spec>`.

    If you run `plugins install` for a plugin id that is already installed, OpenCLI stops and points you at `plugins update <id-or-npm-spec>` for a normal upgrade, or at `plugins install <package> --force` when you genuinely want to overwrite the current install from a different source.

  </Accordion>
  <Accordion title="--pin scope">
    `--pin` applies to npm installs only. It is not supported with `--marketplace`, because marketplace installs persist marketplace source metadata instead of an npm spec.
  </Accordion>
  <Accordion title="--dangerously-force-unsafe-install">
    `--dangerously-force-unsafe-install` is a break-glass option for false positives in the built-in dangerous-code scanner. It allows the install to continue even when the built-in scanner reports `critical` findings, but it does **not** bypass plugin `before_install` hook policy blocks and does **not** bypass scan failures.

    This CLI flag applies to plugin install/update flows. Gateway-backed skill dependency installs use the matching `dangerouslyForceUnsafeInstall` request override, while `opencli skills install` remains a separate ClawHub skill download/install flow.

    If a plugin you published on ClawHub is blocked by a registry scan, use the publisher steps in [ClawHub](/tools/clawhub).

  </Accordion>
  <Accordion title="Hook packs and npm specs">
    `plugins install` is also the install surface for hook packs that expose `opencli.hooks` in `package.json`. Use `opencli hooks` for filtered hook visibility and per-hook enablement, not package installation.

    Npm specs are **registry-only** (package name + optional **exact version** or **dist-tag**). Git/URL/file specs and semver ranges are rejected. Dependency installs run project-local with `--ignore-scripts` for safety, even when your shell has global npm install settings.

    Use `npm:<package>` when you want to skip ClawHub lookup and install directly from npm. Bare package specs still prefer ClawHub and only fall back to npm when ClawHub does not have that package or version.

    Bare specs and `@latest` stay on the stable track. If npm resolves either of those to a prerelease, OpenCLI stops and asks you to opt in explicitly with a prerelease tag such as `@beta`/`@rc` or an exact prerelease version such as `@1.2.3-beta.4`.

    If a bare install spec matches a bundled plugin id (for example `diffs`), OpenCLI installs the bundled plugin directly. To install an npm package with the same name, use an explicit scoped spec (for example `@scope/diffs`).

  </Accordion>
  <Accordion title="Archives">
    Supported archives: `.zip`, `.tgz`, `.tar.gz`, `.tar`. Native OpenCLI plugin archives must contain a valid `opencli.plugin.json` at the extracted plugin root; archives that only contain `package.json` are rejected before OpenCLI writes install records.

    Claude marketplace installs are also supported.

  </Accordion>
</AccordionGroup>

ClawHub installs use an explicit `clawhub:<package>` locator:

```bash
opencli plugins install clawhub:opencli-codex-app-server
opencli plugins install clawhub:opencli-codex-app-server@1.2.3
```

OpenCLI now also prefers ClawHub for bare npm-safe plugin specs. It only falls back to npm if ClawHub does not have that package or version:

```bash
opencli plugins install opencli-codex-app-server
```

Use `npm:` to force npm-only resolution, for example when ClawHub is unreachable or you know the package exists only on npm:

```bash
opencli plugins install npm:opencli-codex-app-server
opencli plugins install npm:@scope/plugin-name@1.0.1
```

OpenCLI downloads the package archive from ClawHub, checks the advertised plugin API / minimum gateway compatibility, then installs it through the normal archive path. Recorded installs keep their ClawHub source metadata for later updates.
Unversioned ClawHub installs keep an unversioned recorded spec so `opencli plugins update` can follow newer ClawHub releases; explicit version or tag selectors such as `clawhub:pkg@1.2.3` and `clawhub:pkg@beta` remain pinned to that selector.

#### Marketplace shorthand

Use `plugin@marketplace` shorthand when the marketplace name exists in Claude's local registry cache at `~/.claude/plugins/known_marketplaces.json`:

```bash
opencli plugins marketplace list <marketplace-name>
opencli plugins install <plugin-name>@<marketplace-name>
```

Use `--marketplace` when you want to pass the marketplace source explicitly:

```bash
opencli plugins install <plugin-name> --marketplace <marketplace-name>
opencli plugins install <plugin-name> --marketplace <owner/repo>
opencli plugins install <plugin-name> --marketplace https://github.com/<owner>/<repo>
opencli plugins install <plugin-name> --marketplace ./my-marketplace
```

<Tabs>
  <Tab title="Marketplace sources">
    - a Claude known-marketplace name from `~/.claude/plugins/known_marketplaces.json`
    - a local marketplace root or `marketplace.json` path
    - a GitHub repo shorthand such as `owner/repo`
    - a GitHub repo URL such as `https://github.com/owner/repo`
    - a git URL

  </Tab>
  <Tab title="Remote marketplace rules">
    For remote marketplaces loaded from GitHub or git, plugin entries must stay inside the cloned marketplace repo. OpenCLI accepts relative path sources from that repo and rejects HTTP(S), absolute-path, git, GitHub, and other non-path plugin sources from remote manifests.
  </Tab>
</Tabs>

For local paths and archives, OpenCLI auto-detects:

- native OpenCLI plugins (`opencli.plugin.json`)
- Codex-compatible bundles (`.codex-plugin/plugin.json`)
- Claude-compatible bundles (`.claude-plugin/plugin.json` or the default Claude component layout)
- Cursor-compatible bundles (`.cursor-plugin/plugin.json`)

<Note>
Compatible bundles install into the normal plugin root and participate in the same list/info/enable/disable flow. Today, bundle skills, Claude command-skills, Claude `settings.json` defaults, Claude `.lsp.json` / manifest-declared `lspServers` defaults, Cursor command-skills, and compatible Codex hook directories are supported; other detected bundle capabilities are shown in diagnostics/info but are not yet wired into runtime execution.
</Note>

### List

```bash
opencli plugins list
opencli plugins list --enabled
opencli plugins list --verbose
opencli plugins list --json
```

<ParamField path="--enabled" type="boolean">
  Show only enabled plugins.
</ParamField>
<ParamField path="--verbose" type="boolean">
  Switch from the table view to per-plugin detail lines with source/origin/version/activation metadata.
</ParamField>
<ParamField path="--json" type="boolean">
  Machine-readable inventory plus registry diagnostics.
</ParamField>

<Note>
`plugins list` reads the persisted local plugin registry first, with a manifest-only derived fallback when the registry is missing or invalid. It is useful for checking whether a plugin is installed, enabled, and visible to cold startup planning, but it is not a live runtime probe of an already-running Gateway process. After changing plugin code, enablement, hook policy, or `plugins.load.paths`, restart the Gateway that serves the channel before expecting new `register(api)` code or hooks to run. For remote/container deployments, verify you are restarting the actual `opencli gateway run` child, not only a wrapper process.
</Note>

For bundled plugin work inside a packaged Docker image, bind-mount the plugin
source directory over the matching packaged source path, such as
`/app/extensions/synology-chat`. OpenCLI will discover that mounted source
overlay before `/app/dist/extensions/synology-chat`; a plain copied source
directory remains inert so normal packaged installs still use compiled dist.

For runtime hook debugging:

- `opencli plugins inspect <id> --json` shows registered hooks and diagnostics from a module-loaded inspection pass.
- `opencli gateway status --deep --require-rpc` confirms the reachable Gateway, service/process hints, config path, and RPC health.
- Non-bundled conversation hooks (`llm_input`, `llm_output`, `before_agent_finalize`, `agent_end`) require `plugins.entries.<id>.hooks.allowConversationAccess=true`.

Use `--link` to avoid copying a local directory (adds to `plugins.load.paths`):

```bash
opencli plugins install -l ./my-plugin
```

<Note>
`--force` is not supported with `--link` because linked installs reuse the source path instead of copying over a managed install target.

Use `--pin` on npm installs to save the resolved exact spec (`name@version`) in the managed plugin index while keeping the default behavior unpinned.
</Note>

### Plugin index

Plugin install metadata is machine-managed state, not user config. Installs and updates write it to `plugins/installs.json` under the active OpenCLI state directory. Its top-level `installRecords` map is the durable source of install metadata, including records for broken or missing plugin manifests. The `plugins` array is the manifest-derived cold registry cache. The file includes a do-not-edit warning and is used by `opencli plugins update`, uninstall, diagnostics, and the cold plugin registry.

When OpenCLI sees shipped legacy `plugins.installs` records in config, it moves them into the plugin index and removes the config key; if either write fails, the config records are kept so the install metadata is not lost.

### Runtime deps

```bash
opencli plugins deps
opencli plugins deps --repair
opencli plugins deps --prune
opencli plugins deps --json
```

`plugins deps` inspects the packaged runtime dependency stage for OpenCLI-owned bundled plugins. It is not the install/update path for third-party npm or ClawHub plugins.

Use `--repair` when a packaged install reports missing bundled runtime dependencies during Gateway startup or `plugins doctor`. Repair installs only missing enabled bundled-plugin deps with lifecycle scripts disabled. Use `--prune` to remove stale unknown external runtime-dependency roots left behind by older packaged layouts.

### Uninstall

```bash
opencli plugins uninstall <id>
opencli plugins uninstall <id> --dry-run
opencli plugins uninstall <id> --keep-files
```

`uninstall` removes plugin records from `plugins.entries`, the persisted plugin index, plugin allow/deny list entries, and linked `plugins.load.paths` entries when applicable. Unless `--keep-files` is set, uninstall also removes the tracked managed install directory when it is inside OpenCLI's plugin extensions root. For active memory plugins, the memory slot resets to `memory-core`.

<Note>
`--keep-config` is supported as a deprecated alias for `--keep-files`.
</Note>

### Update

```bash
opencli plugins update <id-or-npm-spec>
opencli plugins update --all
opencli plugins update <id-or-npm-spec> --dry-run
opencli plugins update @opencli/voice-call@beta
opencli plugins update opencli-codex-app-server --dangerously-force-unsafe-install
```

Updates apply to tracked plugin installs in the managed plugin index and tracked hook-pack installs in `hooks.internal.installs`.

<AccordionGroup>
  <Accordion title="Resolving plugin id vs npm spec">
    When you pass a plugin id, OpenCLI reuses the recorded install spec for that plugin. That means previously stored dist-tags such as `@beta` and exact pinned versions continue to be used on later `update <id>` runs.

    For npm installs, you can also pass an explicit npm package spec with a dist-tag or exact version. OpenCLI resolves that package name back to the tracked plugin record, updates that installed plugin, and records the new npm spec for future id-based updates.

    Passing the npm package name without a version or tag also resolves back to the tracked plugin record. Use this when a plugin was pinned to an exact version and you want to move it back to the registry's default release line.

  </Accordion>
  <Accordion title="Version checks and integrity drift">
    Before a live npm update, OpenCLI checks the installed package version against the npm registry metadata. If the installed version and recorded artifact identity already match the resolved target, the update is skipped without downloading, reinstalling, or rewriting `opencli.json`.

    When a stored integrity hash exists and the fetched artifact hash changes, OpenCLI treats that as npm artifact drift. The interactive `opencli plugins update` command prints the expected and actual hashes and asks for confirmation before proceeding. Non-interactive update helpers fail closed unless the caller supplies an explicit continuation policy.

  </Accordion>
  <Accordion title="--dangerously-force-unsafe-install on update">
    `--dangerously-force-unsafe-install` is also available on `plugins update` as a break-glass override for built-in dangerous-code scan false positives during plugin updates. It still does not bypass plugin `before_install` policy blocks or scan-failure blocking, and it only applies to plugin updates, not hook-pack updates.
  </Accordion>
</AccordionGroup>

### Inspect

```bash
opencli plugins inspect <id>
opencli plugins inspect <id> --json
```

Deep introspection for a single plugin. Shows identity, load status, source, registered capabilities, hooks, tools, commands, services, gateway methods, HTTP routes, policy flags, diagnostics, install metadata, bundle capabilities, and any detected MCP or LSP server support.

Each plugin is classified by what it actually registers at runtime:

- **plain-capability** — one capability type (e.g. a provider-only plugin)
- **hybrid-capability** — multiple capability types (e.g. text + speech + images)
- **hook-only** — only hooks, no capabilities or surfaces
- **non-capability** — tools/commands/services but no capabilities

See [Plugin shapes](/plugins/architecture#plugin-shapes) for more on the capability model.

<Note>
The `--json` flag outputs a machine-readable report suitable for scripting and auditing. `inspect --all` renders a fleet-wide table with shape, capability kinds, compatibility notices, bundle capabilities, and hook summary columns. `info` is an alias for `inspect`.
</Note>

### Doctor

```bash
opencli plugins doctor
```

`doctor` reports plugin load errors, manifest/discovery diagnostics, and compatibility notices. When everything is clean it prints `No plugin issues detected.`

For module-shape failures such as missing `register`/`activate` exports, rerun with `OPENCLI_PLUGIN_LOAD_DEBUG=1` to include a compact export-shape summary in the diagnostic output.

### Registry

```bash
opencli plugins registry
opencli plugins registry --refresh
opencli plugins registry --json
```

The local plugin registry is OpenCLI's persisted cold read model for installed plugin identity, enablement, source metadata, and contribution ownership. Normal startup, provider owner lookup, channel setup classification, and plugin inventory can read it without importing plugin runtime modules.

Use `plugins registry` to inspect whether the persisted registry is present, current, or stale. Use `--refresh` to rebuild it from the persisted plugin index, config policy, and manifest/package metadata. This is a repair path, not a runtime activation path.

<Warning>
`OPENCLI_DISABLE_PERSISTED_PLUGIN_REGISTRY=1` is a deprecated break-glass compatibility switch for registry read failures. Prefer `plugins registry --refresh` or `opencli doctor --fix`; the env fallback is only for emergency startup recovery while the migration rolls out.
</Warning>

### Marketplace

```bash
opencli plugins marketplace list <source>
opencli plugins marketplace list <source> --json
```

Marketplace list accepts a local marketplace path, a `marketplace.json` path, a GitHub shorthand like `owner/repo`, a GitHub repo URL, or a git URL. `--json` prints the resolved source label plus the parsed marketplace manifest and plugin entries.

## Related

- [Building plugins](/plugins/building-plugins)
- [CLI reference](/cli)
- [Community plugins](/plugins/community)
