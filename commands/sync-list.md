---
name: sync-list
description: List all MCP servers configured in Claude Code with transport type and source
---

List all MCP servers that Claude Code knows about.

## Execution Flow

1. Run: `npx sync-agents-settings list`

2. Present the output to the user in a readable format:
   - Group servers by transport type (STDIO, HTTP, SSE)
   - Show the source of each server (config = from ~/.claude.json, plugin = from Claude plugin)
   - Highlight any servers that require OAuth authentication

## Error Handling

- If `npx` fails: suggest `npm install -g sync-agents-settings` as fallback.
