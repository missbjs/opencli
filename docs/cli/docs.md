---
summary: "CLI reference for `opencli docs` (search the live docs index)"
read_when:
  - You want to search the live OpenCLI docs from the terminal
title: "Docs"
---

# `opencli docs`

Search the live docs index.

Arguments:

- `[query...]`: search terms to send to the live docs index

Examples:

```bash
opencli docs
opencli docs browser existing-session
opencli docs sandbox allowHostControl
opencli docs gateway token secretref
```

Notes:

- With no query, `opencli docs` opens the live docs search entrypoint.
- Multi-word queries are passed through as one search request.

## Related

- [CLI reference](/cli)
