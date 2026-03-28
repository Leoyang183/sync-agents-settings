# sync-agents-settings

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/sync-agents-settings?logo=npm)](https://www.npmjs.com/package/sync-agents-settings)
[![npm downloads](https://img.shields.io/npm/dm/sync-agents-settings?logo=npm&label=downloads)](https://www.npmjs.com/package/sync-agents-settings)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green?logo=node.js)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D9-orange?logo=pnpm)](https://pnpm.io/)
[![Vitest](https://img.shields.io/badge/Vitest-4.1-green?logo=vitest)](https://vitest.dev/)
[![MCP](https://img.shields.io/badge/MCP-compatible-8A2BE2)](https://modelcontextprotocol.io/)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?logo=prettier)](https://prettier.io/)
[![CI](https://github.com/Leoyang183/sync-agents-settings/actions/workflows/ci.yml/badge.svg)](https://github.com/Leoyang183/sync-agents-settings/actions/workflows/ci.yml)

Sync MCP server configurations and instruction files (CLAUDE.md) from **Claude Code** to **Gemini CLI**, **Codex CLI**, **OpenCode**, **Kiro CLI**, **Cursor**, **Kimi CLI**, and **Aider CLI**.

**README translations:** [рџ‡№рџ‡ј з№Ѓй«”дё­ж–‡](docs/i18n/README.zh-tw.md) | [рџ‡Ёрџ‡і з®ЂдЅ“дё­ж–‡](docs/i18n/README.zh-cn.md) | [рџ‡Їрџ‡µ ж—Ґжњ¬иЄћ](docs/i18n/README.ja.md) | [рџ‡°рџ‡· н•њкµ­м–ґ](docs/i18n/README.ko.md)
**Support matrix:** [CLI compatibility matrix](docs/compatibility-matrix.md)

## Why

If you use Claude Code as your primary AI coding agent but also switch between other agents (Gemini CLI, Codex CLI, OpenCode, Kiro, Cursor, Kimi CLI) to take advantage of their free tiers or different models, you know the pain вЂ” every tool has its own MCP config format, and setting them up one by one is tedious. Same goes for instruction files вЂ” CLAUDE.md, GEMINI.md, AGENTS.md all need the same content but in different formats.

This tool lets you configure MCP servers and write instructions once in Claude Code, then sync everywhere with a single command.

## Quick Start

### Option A: Claude Code Plugin (recommended)

Use directly inside Claude Code with slash commands:

```bash
# Load the plugin for this session
claude --plugin-dir /path/to/sync-agents-settings

# Then use slash commands in the conversation:
#   /sync-list          вЂ” list all MCP servers
#   /sync               вЂ” sync MCP configs (with dry-run preview)
#   /sync-diff           вЂ” compare configs between agents
#   /sync-doctor         вЂ” detect config drift and parse errors
#   /sync-validate       вЂ” validate schema and target capabilities
#   /sync-reconcile      вЂ” validate + detect drift + sync only missing
#   /report-schema       вЂ” print or write report JSON schema markdown
#   /sync-instructions   вЂ” sync CLAUDE.md to other agents
```

The plugin also includes a **sync-awareness skill** that automatically suggests syncing when you edit MCP settings or CLAUDE.md files.

### Option B: CLI via npx

No installation needed вЂ” just run with `npx`:

```bash
# List all MCP servers detected from Claude Code
npx sync-agents-settings list

# Preview sync (no files modified)
npx sync-agents-settings sync --dry-run

# Sync to all targets (with automatic backup)
npx sync-agents-settings sync

# Sync CLAUDE.md instructions to all targets
npx sync-agents-settings sync-instructions
```

### Option C: Global Install

```bash
# Global install for the `sync-agents` command
npm install -g sync-agents-settings

# Then use directly
sync-agents list
sync-agents sync
```

## Usage

```bash
# Sync to a specific target
sync-agents sync --target gemini
sync-agents sync --target codex
sync-agents sync --target opencode
sync-agents sync --target kiro
sync-agents sync --target cursor
sync-agents sync --target kimi

# Sync to Codex project-level config
sync-agents sync --target codex --codex-home ./my-project/.codex

# Sync to Kimi project-level config
sync-agents sync --target kimi --kimi-home ./my-project/.kimi

# Compare differences
sync-agents diff

# Check drift / parse errors between Claude and targets
sync-agents doctor

# Validate source schema and target capability compatibility
sync-agents validate

# One-shot safe reconcile (validate + doctor + sync missing)
sync-agents reconcile --dry-run

# CI-friendly JSON output
sync-agents reconcile --report json

# CI-friendly JSON output for drift checker
sync-agents doctor --report json

# CI-friendly JSON output for schema/capability validation
sync-agents validate --report json

# CI-friendly JSON output for sync result
sync-agents sync --report json --dry-run

# CI-friendly JSON output for instruction sync
sync-agents sync-instructions --report json --dry-run --global --target gemini

# CI-friendly JSON output for diff result
sync-agents diff --report json --target gemini codex

# Note: all --report json outputs include `schemaVersion: 1`

Report schema reference: `docs/report-schema.md`

# Regenerate report schema documentation
sync-agents report-schema --write docs/report-schema.md

# CI check: ensure report schema doc is up to date
sync-agents report-schema --check

# Auto-fix from doctor (internally runs reconcile)
sync-agents doctor --fix --dry-run

# Auto-fix after validation passes
sync-agents validate --fix --dry-run

# Skip OAuth-only servers (e.g. Slack)
sync-agents sync --skip-oauth

# Skip backup
sync-agents sync --no-backup

# Verbose output
sync-agents sync -v

# Check only specific targets
sync-agents doctor --target gemini codex

# Check Codex project-level config drift
sync-agents doctor --target codex --codex-home ./.codex

# Validate only selected targets and ignore OAuth-only servers
sync-agents validate --target codex opencode --skip-oauth

# Validation semantics:
# - blank-only command/url values are treated as missing
# - OAuth-only servers produce manual-setup warnings without duplicate field errors

# Reconcile selected targets only
sync-agents reconcile --target gemini codex

# Sync instruction files (CLAUDE.md в†’ GEMINI.md / AGENTS.md / Kiro steering / Cursor rules / Aider conventions)
sync-agents sync-instructions

# Sync only global instructions
sync-agents sync-instructions --global

# Sync only project-level instructions
sync-agents sync-instructions --local

# Sync to specific targets
sync-agents sync-instructions --target gemini codex kimi aider

# Auto-overwrite without prompts (for CI)
sync-agents sync-instructions --on-conflict overwrite

# Keep legacy behavior: remove standalone @import lines instead of expanding
sync-agents sync-instructions --import-mode strip

# Allow standalone @import to read files outside current project root (use with care)
sync-agents sync-instructions --allow-unsafe-imports

# Preview instruction sync
sync-agents sync-instructions --dry-run
```

### Development

```bash
git clone https://github.com/Leoyang183/sync-agents-settings.git
cd sync-agents-settings
pnpm install
pnpm dev list        # Run from source
pnpm test            # Run tests
```

## How It Works

**Claude Code is the single source of truth** for MCP settings, synced to all supported targets.

```
                                                 в”Њв”Ђв†’ Gemini Writer   в”Ђв†’ ~/.gemini/settings.json
                                                 в”њв”Ђв†’ Codex Writer    в”Ђв†’ ~/.codex/config.toml
~/.claude.json в”Ђв”Ђв”Ђв”Ђв”Ђв”ђ                            в”‚
                     в”њв”Ђв†’ Reader в”Ђв†’ UnifiedMcpServer[] в”Ђв”јв”Ђв†’ OpenCode Writer в”Ђв†’ ~/.config/opencode/opencode.json
~/.claude/plugins/ в”Ђв”Ђв”                            в”‚
                                                 в”њв”Ђв†’ Kiro Writer     в”Ђв†’ ~/.kiro/settings/mcp.json
                                                 в”њв”Ђв†’ Cursor Writer   в”Ђв†’ ~/.cursor/mcp.json
                                                 в””в”Ђв†’ Kimi Writer     в”Ђв†’ ~/.kimi/mcp.json
```

| Stage | Description |
|-------|-------------|
| **Reader** | Reads from `~/.claude.json` and enabled plugin `.mcp.json` files, merges into a unified format |
| **Gemini Writer** | JSON в†’ JSON, `type: "http"` в†’ `httpUrl`, `${VAR}` в†’ `$VAR` |
| **Codex Writer** | JSON в†’ TOML, `${VAR:-default}` в†’ expanded to actual value (env value or fallback) |
| **OpenCode Writer** | JSON в†’ JSON, `command`+`args` в†’ merged `command` array, `env` в†’ `environment`, `type: "local"`/`"remote"` |
| **Kiro Writer** | Same format as Claude, `${VAR:-default}` в†’ expanded |
| **Cursor Writer** | Same format as Claude, `${VAR:-default}` в†’ expanded |
| **Kimi Writer** | Same format as Claude, `${VAR:-default}` в†’ expanded |

### Instruction Sync (`sync-instructions`)

Syncs CLAUDE.md instruction files to each target's native format:

```
                                          в”Њв”Ђв†’ ~/.gemini/GEMINI.md             (plain copy)
                                          в”њв”Ђв†’ ~/.codex/AGENTS.md              (plain copy)
~/.claude/CLAUDE.md (+ ~/.claude/rules/*.md) в”Ђв†’ expand @imports в”Ђв”Ђв”јв”Ђв†’ ~/.config/opencode/AGENTS.md    (plain copy)
                                          в”њв”Ђв†’ ~/.kimi/AGENTS.md               (plain copy)
                                          в”њв”Ђв†’ ~/.kiro/steering/claude-instructions.md  (+ inclusion: always)
                                          в””в”Ђв†’ вљ  Cursor global not supported  (SQLite)

                                          в”Њв”Ђв†’ ./GEMINI.md                     (plain copy)
                                          в”њв”Ђв†’ ./AGENTS.md                     (Codex + OpenCode + Kimi share)
./.claude/CLAUDE.md (fallback: ./CLAUDE.md) + ./.claude/rules/*.md в”Ђв†’ expand @imports в”Ђв”Ђв”јв”Ђв†’ .kiro/steering/claude-instructions.md    (+ inclusion: always)
                                          в””в”Ђв†’ .cursor/rules/claude-instructions.mdc   (+ alwaysApply: true)
```

| Target | Global | Local | Format Transform |
|--------|--------|-------|------------------|
| Gemini | `~/.gemini/GEMINI.md` | `./GEMINI.md` | Plain copy (expand standalone `@import` lines) |
| Codex | `~/.codex/AGENTS.md` | `./AGENTS.md` | Plain copy (expand standalone `@import` lines) |
| OpenCode | `~/.config/opencode/AGENTS.md` | `./AGENTS.md` (shared with Codex) | Plain copy (expand standalone `@import` lines) |
| Kimi | `~/.kimi/AGENTS.md` | `./AGENTS.md` (shared with Codex/OpenCode) | Plain copy (expand standalone `@import` lines) |
| Aider | `~/.aider/CONVENTIONS.md` | `.aider/CONVENTIONS.md` | Plain copy + upsert `read` entry in `.aider.conf.yml` |
| Kiro | `~/.kiro/steering/claude-instructions.md` | `.kiro/steering/claude-instructions.md` | Add `inclusion: always` frontmatter |
| Cursor | Not supported (SQLite) | `.cursor/rules/claude-instructions.mdc` | Add `alwaysApply: true` frontmatter |

Notes:
- Local source resolution prefers `./.claude/CLAUDE.md`, then falls back to `./CLAUDE.md`.
- Extra rules in `.claude/rules/**/*.md` are appended automatically (unless already included via `@import`).
- If a rule file has frontmatter `paths`, it is included only when at least one project file matches.
- `@import` handling defaults to `inline` (expand). Use `--import-mode strip` to remove standalone import lines.
- By default, standalone `@import` can only read files inside the current project root. Use `--allow-unsafe-imports` to opt out.
- Inline import expansion has guardrails (`max depth: 20`, `max files: 200`) to avoid runaway recursion.
- Aider sync also upserts `.aider.conf.yml` `read` so `CONVENTIONS.md` is loaded automatically (global/project follows the sync scope).
- Kimi CLI currently loads `AGENTS.md` from the working directory. `~/.kimi/AGENTS.md` is synced as a reusable global template.

When a target file already exists, you'll be prompted to choose: **overwrite**, **append** (keep existing + add CLAUDE.md below), or **skip**. Use `--on-conflict overwrite|append|skip` for non-interactive mode.

**Safety mechanisms:**
- Existing servers are never overwritten (idempotent, safe to re-run)
- Automatic backup to `~/.sync-agents-backup/` by default (`--no-backup` to skip)
- `--dry-run` previews changes without writing any files

### Source: Claude Code

Reads MCP servers from two sources:

1. **`~/.claude.json`** в†’ `mcpServers` object (user-configured servers)
2. **`~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/.mcp.json`** в†’ enabled plugin MCP servers (matched against `~/.claude/settings.json` `enabledPlugins`)

Claude Code has two `.mcp.json` formats:

```jsonc
// Format 1: Flat (e.g. context7, firebase)
{ "context7": { "command": "npx", "args": ["-y", "@upstash/context7-mcp"] } }

// Format 2: Nested under mcpServers (e.g. sentry, stripe)
{ "mcpServers": { "sentry": { "type": "http", "url": "https://mcp.sentry.dev/mcp" } } }
```

Because sync-agents-settings preserves stdio command entries, the Claude-side source can also be a firewall-wrapped MCP server:

```json
{
  "mcpServers": {
    "filesystem-safe": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-transport-firewall",
        "--",
        "npx",
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "."
      ]
    }
  }
}
```

More package-first launch patterns are documented at https://github.com/shleder/mcp-transport-firewall/blob/main/docs/CLIENT_CONFIGS.md.

### Target: Gemini CLI

Writes to **`~/.gemini/settings.json`** в†’ `mcpServers` object.

Key format differences from Claude:
- Claude `type: "http"` в†’ Gemini `httpUrl`
- Claude `type: "sse"` в†’ Gemini `url`
- Claude `command` (stdio) в†’ Gemini `command` (same)
- Env var syntax: Claude `${VAR}` в†’ Gemini `$VAR` (auto-converted)

```jsonc
// Gemini settings.json
{
  "theme": "Dracula",          // existing settings preserved
  "mcpServers": {
    "context7": {              // stdio server
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    },
    "sentry": {                // http server
      "httpUrl": "https://mcp.sentry.dev/mcp"
    }
  }
}
```

### Target: Codex CLI

Writes to **`~/.codex/config.toml`** (global) by default. Use `--codex-home <path>` to write to a project-level `.codex/config.toml` instead.

> **Note:** Codex CLI does NOT merge global and project configs. When a project has `.codex/`, Codex only reads that directory. Global `~/.codex/` is ignored entirely.

Key format differences:
- Uses TOML instead of JSON
- `command`/`args` for stdio (same concept)
- `url` for HTTP servers (no type field needed)
- `env` is a TOML sub-table `[mcp_servers.<name>.env]`

```toml
[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]

[mcp_servers.sentry]
url = "https://mcp.sentry.dev/mcp"

[mcp_servers.n8n-mcp]
command = "npx"
args = ["n8n-mcp"]

  [mcp_servers.n8n-mcp.env]
  N8N_API_KEY = "your-key"
  N8N_API_URL = "https://your-n8n.example.com"
```

### Target: OpenCode

Writes to **`~/.config/opencode/opencode.json`** в†’ `mcp` object.

Key format differences:
- Root key is `mcp` (not `mcpServers`)
- stdio servers use `type: "local"` with a merged `command` array (command + args combined)
- HTTP/SSE servers use `type: "remote"`
- Environment variables use `environment` field (not `env`)

```jsonc
// opencode.json
{
  "model": "anthropic/claude-sonnet-4-5",  // existing settings preserved
  "mcp": {
    "context7": {                          // stdio в†’ local
      "type": "local",
      "command": ["npx", "-y", "@upstash/context7-mcp"]
    },
    "sentry": {                            // http в†’ remote
      "type": "remote",
      "url": "https://mcp.sentry.dev/mcp"
    },
    "n8n-mcp": {                           // env в†’ environment
      "type": "local",
      "command": ["npx", "n8n-mcp"],
      "environment": {
        "N8N_API_KEY": "your-key"
      }
    }
  }
}
```

### Target: Kiro CLI

Writes to **`~/.kiro/settings/mcp.json`** в†’ `mcpServers` object.

Same format as Claude Code. `${VAR:-default}` syntax in URLs is auto-expanded during sync.

### Target: Cursor

Writes to **`~/.cursor/mcp.json`** в†’ `mcpServers` object.

Same format as Claude Code. `${VAR:-default}` syntax in URLs is auto-expanded during sync.

### Target: Kimi CLI

Writes to **`~/.kimi/mcp.json`** by default. Use `--kimi-home <path>` to sync to a custom base directory (for example, project-level `.kimi/`).

Same format as Claude Code. `${VAR:-default}` syntax in URLs is auto-expanded during sync.

## Transport Type Mapping

| Claude Code | Gemini CLI | Codex CLI | OpenCode | Kiro CLI | Cursor | Kimi CLI |
|------------|-----------|----------|----------|----------|--------|----------|
| `command` + `args` (stdio) | `command` + `args` | `command` + `args` | `type: "local"`, `command: [cmd, ...args]` | same as Claude | same as Claude | same as Claude |
| `type: "http"` + `url` | `httpUrl` | `url` | `type: "remote"`, `url` | same as Claude | same as Claude | same as Claude |
| `type: "sse"` + `url` | `url` | `url` | `type: "remote"`, `url` | same as Claude | same as Claude | same as Claude |
| `env` | `env` | `env` | `environment` | `env` | `env` | `env` |
| `oauth` | skipped | skipped | skipped | skipped | skipped | skipped |

## Backup

Every sync automatically backs up all affected config files to `~/.sync-agents-backup/<timestamp>/` before writing, preserving the original directory structure relative to `~`:

```
~/.sync-agents-backup/2026-03-20T00-06-08-042Z/
в”њв”Ђв”Ђ .claude.json                  # в†ђ ~/.claude.json
в”њв”Ђв”Ђ .claude/
в”‚   в””в”Ђв”Ђ settings.json             # в†ђ ~/.claude/settings.json
в”њв”Ђв”Ђ .gemini/
в”‚   в””в”Ђв”Ђ settings.json             # в†ђ ~/.gemini/settings.json
в”њв”Ђв”Ђ .codex/
в”‚   в””в”Ђв”Ђ config.toml               # в†ђ ~/.codex/config.toml
в”њв”Ђв”Ђ .config/
в”‚   в””в”Ђв”Ђ opencode/
в”‚       в””в”Ђв”Ђ opencode.json         # в†ђ ~/.config/opencode/opencode.json
в”њв”Ђв”Ђ .kiro/
в”‚   в””в”Ђв”Ђ settings/
в”‚       в””в”Ђв”Ђ mcp.json              # в†ђ ~/.kiro/settings/mcp.json
в”њв”Ђв”Ђ .cursor/
в”‚   в””в”Ђв”Ђ mcp.json                  # в†ђ ~/.cursor/mcp.json
в””в”Ђв”Ђ .kimi/
    в””в”Ђв”Ђ mcp.json                  # в†ђ ~/.kimi/mcp.json
```

Use `--no-backup` to skip. Target directories that don't exist (CLI not installed) will be skipped with a warning, not created.

## Config File Locations

### MCP Settings

| Tool | Config Path | Format |
|------|-----------|--------|
| Claude Code (user MCP) | `~/.claude.json` | JSON |
| Claude Code (settings) | `~/.claude/settings.json` | JSON |
| Claude Code (plugin MCP) | `~/.claude/plugins/cache/.../.mcp.json` | JSON |
| Gemini CLI | `~/.gemini/settings.json` | JSON |
| Codex CLI (global) | `~/.codex/config.toml` | TOML |
| Codex CLI (project) | `.codex/config.toml` (use `--codex-home`) | TOML |
| OpenCode (global) | `~/.config/opencode/opencode.json` | JSON |
| OpenCode (project) | `opencode.json` in project root | JSON |
| Kiro CLI (global) | `~/.kiro/settings/mcp.json` | JSON |
| Kiro CLI (project) | `.kiro/settings/mcp.json` in project root | JSON |
| Cursor (global) | `~/.cursor/mcp.json` | JSON |
| Cursor (project) | `.cursor/mcp.json` in project root | JSON |
| Kimi CLI (global) | `~/.kimi/mcp.json` | JSON |
| Kimi CLI (project) | `.kimi/mcp.json` (use `--kimi-home ./.kimi`) | JSON |

### Instruction Files

| Tool | Global Path | Project Path | Format |
|------|------------|-------------|--------|
| Claude Code | `~/.claude/CLAUDE.md` | `./.claude/CLAUDE.md` (fallback `./CLAUDE.md`) | Markdown |
| Gemini CLI | `~/.gemini/GEMINI.md` | `./GEMINI.md` | Markdown |
| Codex CLI | `~/.codex/AGENTS.md` | `./AGENTS.md` | Markdown |
| OpenCode | `~/.config/opencode/AGENTS.md` | `./AGENTS.md` | Markdown |
| Kimi CLI | `~/.kimi/AGENTS.md` | `./AGENTS.md` | Markdown |
| Kiro CLI | `~/.kiro/steering/claude-instructions.md` | `.kiro/steering/claude-instructions.md` | Markdown + frontmatter |
| Cursor | Not supported (SQLite) | `.cursor/rules/claude-instructions.mdc` | MDC (Markdown + frontmatter) |

## Claude Code Plugin

This project can be used as a Claude Code plugin, providing slash commands and a contextual skill directly inside Claude Code conversations.

### Slash Commands

| Command | Description |
|---------|-------------|
| `/sync` | Sync MCP server configs to other agents (with dry-run preview and confirmation) |
| `/sync-list` | List all MCP servers configured in Claude Code |
| `/sync-diff` | Compare MCP configs between Claude and other agents |
| `/sync-instructions` | Sync CLAUDE.md instruction files to other agent formats |

### Sync-Awareness Skill

The plugin includes a skill that automatically detects when you're editing MCP settings (`.claude.json`, `.mcp.json`) or `CLAUDE.md` files, and suggests syncing to other agents.

### Plugin Development

```bash
# Validate plugin structure
claude plugins validate /path/to/sync-agents-settings

# Test locally (loads plugin for this session only)
claude --plugin-dir /path/to/sync-agents-settings
```

## Limitations

- **OAuth servers** (e.g. Slack with `oauth.clientId`) are synced as URL-only вЂ” you'll need to authenticate manually in each CLI
- **`${CLAUDE_PLUGIN_ROOT}`** env vars won't resolve in other CLIs
- Codex CLI doesn't support `${VAR:-default}` syntax in URLs вЂ” these are auto-expanded during sync (env value if set, otherwise the default)
- Re-running sync will **not overwrite** existing entries (safe to run multiple times)
- Codex CLI does NOT merge global and project configs вЂ” when `.codex/` exists in a project, global `~/.codex/` is ignored
- If target config directories don't exist, sync will skip that target (won't create directories)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Leoyang183/sync-agents-settings&type=Date)](https://star-history.com/#Leoyang183/sync-agents-settings&Date)

## License

MIT
