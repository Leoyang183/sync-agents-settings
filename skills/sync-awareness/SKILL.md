---
name: sync-awareness
description: "Suggest syncing MCP server configurations or instruction files to other AI coding agents when the user is editing MCP settings (.claude.json, .mcp.json) or modifying CLAUDE.md files. Available commands: /sync, /sync-list, /sync-diff, /sync-instructions."
version: 1.0.0
---

# Sync Awareness

When you detect that the user is working with MCP server configurations or CLAUDE.md instruction files, suggest syncing to other AI agents.

## When to Suggest

### MCP Config Context

If the conversation involves editing or discussing `.claude.json` or `.mcp.json` files (specifically the `mcpServers` section):

> You're working with MCP server settings. Want to sync to other AI agents? Use `/sync` to sync, or `/sync-diff` to check differences first.

### CLAUDE.md Context

If the conversation involves editing or discussing `CLAUDE.md` files:

> You're updating CLAUDE.md. Want to sync instructions to other AI agents? Use `/sync-instructions` to sync.

## Rules

- **Suggest only once** per relevant context. Do not repeat the suggestion if the user has already seen it or dismissed it.
- **Never auto-execute** sync commands. Only suggest them.
- **Keep it brief** — one or two sentences maximum.
- **Do not suggest** if the user is already using one of the sync commands.

## Available Commands

- `/sync` — Sync MCP server configs to other agents
- `/sync-list` — List all MCP servers in Claude Code
- `/sync-diff` — Compare MCP configs between Claude and other agents
- `/sync-instructions` — Sync CLAUDE.md to other agent instruction formats
