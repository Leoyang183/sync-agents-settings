---
name: sync-diff
description: Compare MCP server configurations between Claude Code and other AI agents
---

Compare which MCP servers exist in Claude Code vs other AI agents.

## Arguments

The user may pass target names: `/sync-diff gemini`
If no targets specified, compare all targets (gemini, codex, opencode, kiro, cursor).

## Execution Flow

1. Parse targets from user arguments. Run:
   `npx sync-agents-settings diff --target <targets>`

2. Present the comparison for each target:
   - **Shared** — servers that exist in both Claude and the target
   - **Only in Claude** — servers that could be synced to the target
   - **Only in target** — servers that exist in the target but not in Claude

3. If there are servers "Only in Claude", suggest: "Run `/sync` to sync these servers to the target agents."

## Error Handling

- If `npx` fails: suggest `npm install -g sync-agents-settings` as fallback.
- Note: Codex diff shows a message to use `codex mcp list` instead (CLI limitation).
