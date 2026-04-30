---
summary: "CLI reference for `opencli agents` (list/add/delete/bindings/bind/unbind/set identity)"
read_when:
  - You want multiple isolated agents (workspaces + routing + auth)
title: "Agents"
---

# `opencli agents`

Manage isolated agents (workspaces + auth + routing).

Related:

- [Multi-agent routing](/concepts/multi-agent)
- [Agent workspace](/concepts/agent-workspace)
- [Skills config](/tools/skills-config): skill visibility configuration.

## Examples

```bash
opencli agents list
opencli agents list --bindings
opencli agents add work --workspace ~/.opencli/workspace-work
opencli agents add ops --workspace ~/.opencli/workspace-ops --bind telegram:ops --non-interactive
opencli agents bindings
opencli agents bind --agent work --bind telegram:ops
opencli agents unbind --agent work --bind telegram:ops
opencli agents set-identity --workspace ~/.opencli/workspace --from-identity
opencli agents set-identity --agent main --avatar avatars/opencli.png
opencli agents delete work
```

## Routing bindings

Use routing bindings to pin inbound channel traffic to a specific agent.

If you also want different visible skills per agent, configure `agents.defaults.skills` and `agents.list[].skills` in `opencli.json`. See [Skills config](/tools/skills-config) and [Configuration reference](/gateway/config-agents#agents-defaults-skills).

List bindings:

```bash
opencli agents bindings
opencli agents bindings --agent work
opencli agents bindings --json
```

Add bindings:

```bash
opencli agents bind --agent work --bind telegram:ops --bind discord:guild-a
```

If you omit `accountId` (`--bind <channel>`), OpenCLI resolves it from channel defaults and plugin setup hooks when available.

If you omit `--agent` for `bind` or `unbind`, OpenCLI targets the current default agent.

### Binding scope behavior

- A binding without `accountId` matches the channel default account only.
- `accountId: "*"` is the channel-wide fallback (all accounts) and is less specific than an explicit account binding.
- If the same agent already has a matching channel binding without `accountId`, and you later bind with an explicit or resolved `accountId`, OpenCLI upgrades that existing binding in place instead of adding a duplicate.

Example:

```bash
# initial channel-only binding
opencli agents bind --agent work --bind telegram

# later upgrade to account-scoped binding
opencli agents bind --agent work --bind telegram:ops
```

After the upgrade, routing for that binding is scoped to `telegram:ops`. If you also want default-account routing, add it explicitly (for example `--bind telegram:default`).

Remove bindings:

```bash
opencli agents unbind --agent work --bind telegram:ops
opencli agents unbind --agent work --all
```

`unbind` accepts either `--all` or one or more `--bind` values, not both.

## Command surface

### `agents`

Running `opencli agents` with no subcommand is equivalent to `opencli agents list`.

### `agents list`

Options:

- `--json`
- `--bindings`: include full routing rules, not only per-agent counts/summaries

### `agents add [name]`

Options:

- `--workspace <dir>`
- `--model <id>`
- `--agent-dir <dir>`
- `--bind <channel[:accountId]>` (repeatable)
- `--non-interactive`
- `--json`

Notes:

- Passing any explicit add flags switches the command into the non-interactive path.
- Non-interactive mode requires both an agent name and `--workspace`.
- `main` is reserved and cannot be used as the new agent id.
- In interactive mode, auth seeding copies only portable static profiles
  (`api_key` and static `token` by default). OAuth refresh-token profiles remain
  available only by read-through inheritance from the real `main` agent store.
  If the configured default agent is not `main`, sign in separately for OAuth
  profiles on the new agent.

### `agents bindings`

Options:

- `--agent <id>`
- `--json`

### `agents bind`

Options:

- `--agent <id>` (defaults to the current default agent)
- `--bind <channel[:accountId]>` (repeatable)
- `--json`

### `agents unbind`

Options:

- `--agent <id>` (defaults to the current default agent)
- `--bind <channel[:accountId]>` (repeatable)
- `--all`
- `--json`

### `agents delete <id>`

Options:

- `--force`
- `--json`

Notes:

- `main` cannot be deleted.
- Without `--force`, interactive confirmation is required.
- Workspace, agent state, and session transcript directories are moved to Trash, not hard-deleted.
- If another agent's workspace is the same path, inside this workspace, or contains this workspace,
  the workspace is retained and `--json` reports `workspaceRetained`,
  `workspaceRetainedReason`, and `workspaceSharedWith`.

## Identity files

Each agent workspace can include an `IDENTITY.md` at the workspace root:

- Example path: `~/.opencli/workspace/IDENTITY.md`
- `set-identity --from-identity` reads from the workspace root (or an explicit `--identity-file`)

Avatar paths resolve relative to the workspace root.

## Set identity

`set-identity` writes fields into `agents.list[].identity`:

- `name`
- `theme`
- `emoji`
- `avatar` (workspace-relative path, http(s) URL, or data URI)

Options:

- `--agent <id>`
- `--workspace <dir>`
- `--identity-file <path>`
- `--from-identity`
- `--name <name>`
- `--theme <theme>`
- `--emoji <emoji>`
- `--avatar <value>`
- `--json`

Notes:

- `--agent` or `--workspace` can be used to select the target agent.
- If you rely on `--workspace` and multiple agents share that workspace, the command fails and asks you to pass `--agent`.
- When no explicit identity fields are provided, the command reads identity data from `IDENTITY.md`.

Load from `IDENTITY.md`:

```bash
opencli agents set-identity --workspace ~/.opencli/workspace --from-identity
```

Override fields explicitly:

```bash
opencli agents set-identity --agent main --name "OpenCLI" --emoji "🦞" --avatar avatars/opencli.png
```

Config sample:

```json5
{
  agents: {
    list: [
      {
        id: "main",
        identity: {
          name: "OpenCLI",
          theme: "space lobster",
          emoji: "🦞",
          avatar: "avatars/opencli.png",
        },
      },
    ],
  },
}
```

## Related

- [CLI reference](/cli)
- [Multi-agent routing](/concepts/multi-agent)
- [Agent workspace](/concepts/agent-workspace)
