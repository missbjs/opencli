---
summary: "Diagnostics flags for targeted debug logs"
read_when:
  - You need targeted debug logs without raising global logging levels
  - You need to capture subsystem-specific logs for support
title: "Diagnostics flags"
---

Diagnostics flags let you enable targeted debug logs without turning on verbose logging everywhere. Flags are opt-in and have no effect unless a subsystem checks them.

## How it works

- Flags are strings (case-insensitive).
- You can enable flags in config or via an env override.
- Wildcards are supported:
  - `telegram.*` matches `telegram.http`
  - `*` enables all flags

## Enable via config

```json
{
  "diagnostics": {
    "flags": ["telegram.http"]
  }
}
```

Multiple flags:

```json
{
  "diagnostics": {
    "flags": ["telegram.http", "gateway.*"]
  }
}
```

Restart the gateway after changing flags.

## Env override (one-off)

```bash
OPENCLI_DIAGNOSTICS=telegram.http,telegram.payload
```

Disable all flags:

```bash
OPENCLI_DIAGNOSTICS=0
```

## Timeline artifacts

The `timeline` flag writes structured startup and runtime timing events for
external QA harnesses:

```bash
OPENCLI_DIAGNOSTICS=timeline \
OPENCLI_DIAGNOSTICS_TIMELINE_PATH=/tmp/opencli-timeline.jsonl \
opencli gateway run
```

You can also enable it in config:

```json
{
  "diagnostics": {
    "flags": ["timeline"]
  }
}
```

The timeline file path still comes from
`OPENCLI_DIAGNOSTICS_TIMELINE_PATH`. When `timeline` is enabled only from
config, the earliest config-loading spans are not emitted because OpenCLI has
not read config yet; subsequent startup spans use the config flag.

`OPENCLI_DIAGNOSTICS=1`, `OPENCLI_DIAGNOSTICS=all`, and
`OPENCLI_DIAGNOSTICS=*` also enable the timeline because they enable every
diagnostics flag. Prefer `timeline` when you only want the JSONL timing
artifact.

Timeline records use the `opencli.diagnostics.v1` envelope. Events can include
process ids, phase names, span names, durations, plugin ids, dependency counts,
event-loop delay samples, provider operation names, child-process exit state,
and startup error names/messages. Treat timeline files as local diagnostics
artifacts; review them before sharing outside your machine.

## Where logs go

Flags emit logs into the standard diagnostics log file. By default:

```
/tmp/opencli/opencli-YYYY-MM-DD.log
```

If you set `logging.file`, use that path instead. Logs are JSONL (one JSON object per line). Redaction still applies based on `logging.redactSensitive`.

## Extract logs

Pick the latest log file:

```bash
ls -t /tmp/opencli/opencli-*.log | head -n 1
```

Filter for Telegram HTTP diagnostics:

```bash
rg "telegram http error" /tmp/opencli/opencli-*.log
```

Or tail while reproducing:

```bash
tail -f /tmp/opencli/opencli-$(date +%F).log | rg "telegram http error"
```

For remote gateways, you can also use `opencli logs --follow` (see [/cli/logs](/cli/logs)).

## Notes

- If `logging.level` is set higher than `warn`, these logs may be suppressed. Default `info` is fine.
- Flags are safe to leave enabled; they only affect log volume for the specific subsystem.
- Use [/logging](/logging) to change log destinations, levels, and redaction.

## Related

- [Gateway diagnostics](/gateway/diagnostics)
- [Gateway troubleshooting](/gateway/troubleshooting)
