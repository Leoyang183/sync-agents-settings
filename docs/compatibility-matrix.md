# CLI Compatibility Matrix

This matrix tracks what `sync-agents-settings` supports today across rule files and MCP settings.

## Rule File Sync Matrix

| CLI | Global rule file (target) | Project rule file (target) | Global sync | Project sync | Status |
|---|---|---|---|---|---|
| Gemini CLI | `~/.gemini/GEMINI.md` | `./GEMINI.md` | Yes | Yes | Supported |
| Codex CLI | `~/.codex/AGENTS.md` | `./AGENTS.md` | Yes | Yes | Supported |
| OpenCode | `~/.config/opencode/AGENTS.md` | `./AGENTS.md` | Yes | Yes | Supported |
| Kimi CLI | `~/.kimi/AGENTS.md` | `./AGENTS.md` | Yes | Yes | Supported |
| Vibe CLI | `~/.vibe/AGENTS.md` | `./AGENTS.md` | Yes | Yes | Supported |
| Aider CLI | `~/.aider/CONVENTIONS.md` | `.aider/CONVENTIONS.md` | Yes | Yes | Supported |
| Kiro CLI | `~/.kiro/steering/claude-instructions.md` | `.kiro/steering/claude-instructions.md` | Yes | Yes | Supported |
| Cursor | N/A (SQLite-managed global rules) | `.cursor/rules/claude-instructions.mdc` | No | Yes | Project-only |

Notes:
- Local source resolution prefers `./.claude/CLAUDE.md`, then falls back to `./CLAUDE.md`.
- For `AGENTS.md`-based targets, local output is intentionally shared at `./AGENTS.md`.
- Aider sync also updates `read` in `.aider.conf.yml` (global: `~/.aider.conf.yml`, project: `./.aider.conf.yml`).

## MCP Sync Matrix

| CLI | Global MCP config (target) | Project MCP config (target) | Global sync | Project sync | Status |
|---|---|---|---|---|---|
| Gemini CLI | `~/.gemini/settings.json` | `.gemini/settings.json` | Yes | Yes | Supported |
| Codex CLI | `~/.codex/config.toml` | `.codex/config.toml` | Yes | Yes | Supported |
| OpenCode | `~/.config/opencode/opencode.json` | `opencode.json` | Yes | Yes | Supported |
| Kimi CLI | `~/.kimi/mcp.json` | `.kimi/mcp.json` | Yes | Yes | Supported |
| Vibe CLI | `~/.vibe/config.toml` | `.vibe/config.toml` | Yes | Yes | Supported |
| Aider CLI | N/A | N/A | No | No | Planned (experimental backlog) |
| Kiro CLI | `~/.kiro/settings/mcp.json` | `.kiro/settings/mcp.json` | Yes | Yes | Supported |
| Cursor | `~/.cursor/mcp.json` | `.cursor/mcp.json` | Yes | Yes | Supported |

## Validation Checklist

Use this quick checklist when adding a new target or changing an existing one:

1. Confirm rule-file path(s): global and project.
2. Confirm MCP path(s): global and project.
3. Verify format transform requirements (frontmatter, schema, naming).
4. Verify dry-run report output (`--report json`) for both `sync` and `sync-instructions`.
5. Verify idempotency (re-running does not duplicate/overwrite existing unmanaged entries).
