---
summary: "Redirect: flow commands live under `opencli tasks flow`"
read_when:
  - You encounter opencli flows in older docs or release notes
title: "Flows (redirect)"
---

# `opencli tasks flow`

Flow commands are subcommands of `opencli tasks`, not a standalone `flows` command.

```bash
opencli tasks flow list [--json]
opencli tasks flow show <lookup>
opencli tasks flow cancel <lookup>
```

For full documentation see [Task Flow](/automation/taskflow) and the [tasks CLI reference](/cli/tasks).

## Related

- [CLI reference](/cli)
- [Automation](/automation)
