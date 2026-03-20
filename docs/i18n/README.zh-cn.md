# sync-agents-settings

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/sync-agents-settings?logo=npm)](https://www.npmjs.com/package/sync-agents-settings)
[![npm downloads](https://img.shields.io/npm/dm/sync-agents-settings?logo=npm&label=downloads)](https://www.npmjs.com/package/sync-agents-settings)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-compatible-8A2BE2)](https://modelcontextprotocol.io/)
[![CI](https://github.com/Leoyang183/sync-agents-settings/actions/workflows/ci.yml/badge.svg)](https://github.com/Leoyang183/sync-agents-settings/actions/workflows/ci.yml)

将 **Claude Code** 的 MCP server 配置和指令文件（CLAUDE.md）同步到 **Gemini CLI**、**Codex CLI**、**OpenCode**、**Kiro CLI** 和 **Cursor**。

**其他语言：** [🇺🇸 English](../../README.md) | [🇹🇼 繁體中文](README.zh-tw.md) | [🇯🇵 日本語](README.ja.md) | [🇰🇷 한국어](README.ko.md)

## 为什么需要这个工具

如果你主要用 Claude Code 开发，但也会切换其他 AI agent（Gemini CLI、Codex CLI、OpenCode、Kiro、Cursor）来利用各家的免费额度或不同模型，你一定知道这个痛点——每个工具的 MCP 配置格式都不一样，一个一个配置实在太累。

指令文件也是一样——CLAUDE.md、GEMINI.md、AGENTS.md 都需要相同的内容，但格式各不相同。

这个工具让你只在 Claude Code 配置一次 MCP servers 和编写指令，一行命令同步到所有目标。

## 快速开始

无需安装，直接用 `npx`：

```bash
# 列出所有 Claude Code 的 MCP servers
npx sync-agents-settings list

# 预览同步（不修改任何文件）
npx sync-agents-settings sync --dry-run

# 同步到所有目标（自动备份）
npx sync-agents-settings sync

# 同步 CLAUDE.md 指令文件到所有目标
npx sync-agents-settings sync-instructions
```

## 安装（可选）

```bash
# 全局安装，使用 sync-agents 命令
npm install -g sync-agents-settings

# 直接使用
sync-agents list
sync-agents sync
```

## 使用方式

```bash
# 同步到特定目标
sync-agents sync --target gemini
sync-agents sync --target codex
sync-agents sync --target opencode
sync-agents sync --target kiro
sync-agents sync --target cursor

# 同步到 Codex 项目级配置
sync-agents sync --target codex --codex-home ./my-project/.codex

# 比较差异
sync-agents diff

# 跳过需要 OAuth 的服务器（如 Slack）
sync-agents sync --skip-oauth

# 跳过备份
sync-agents sync --no-backup

# 详细输出
sync-agents sync -v

# 同步指令文件（CLAUDE.md → GEMINI.md / AGENTS.md / Kiro steering / Cursor rules）
sync-agents sync-instructions

# 只同步全局指令
sync-agents sync-instructions --global

# 只同步项目级指令
sync-agents sync-instructions --local

# 同步到特定目标
sync-agents sync-instructions --target gemini codex

# 自动覆盖不询问（适用于 CI）
sync-agents sync-instructions --on-conflict overwrite

# 预览指令同步
sync-agents sync-instructions --dry-run
```

## 工作原理

**Claude Code 是 MCP 配置的 Single Source of Truth**，同步到所有支持的目标。

```
                                                 ┌─→ Gemini Writer   ─→ ~/.gemini/settings.json
                                                 ├─→ Codex Writer    ─→ ~/.codex/config.toml
~/.claude.json ─────┐                            │
                     ├─→ Reader ─→ UnifiedMcpServer[] ─┼─→ OpenCode Writer ─→ ~/.config/opencode/opencode.json
~/.claude/plugins/ ──┘                            │
                                                 ├─→ Kiro Writer     ─→ ~/.kiro/settings/mcp.json
                                                 └─→ Cursor Writer   ─→ ~/.cursor/mcp.json
```

| 阶段 | 说明 |
|------|------|
| **Reader** | 从 `~/.claude.json` 和已启用插件的 `.mcp.json` 读取，合并为统一格式 |
| **Gemini Writer** | JSON → JSON，`type: "http"` → `httpUrl`，`${VAR}` → `$VAR` |
| **Codex Writer** | JSON → TOML，`${VAR:-default}` → 展开为实际值 |
| **OpenCode Writer** | JSON → JSON，`command`+`args` → 合并为 `command` 数组，`env` → `environment`，`type: "local"`/`"remote"` |
| **Kiro Writer** | 与 Claude 相同格式，`${VAR:-default}` → 展开 |
| **Cursor Writer** | 与 Claude 相同格式，`${VAR:-default}` → 展开 |

### 指令文件同步（`sync-instructions`）

将 CLAUDE.md 指令文件同步到各目标的原生格式：

| 目标 | 全局路径 | 项目路径 | 格式转换 |
|------|---------|---------|---------|
| Gemini | `~/.gemini/GEMINI.md` | `./GEMINI.md` | 直接复制（过滤 `@import` 行） |
| Codex | `~/.codex/AGENTS.md` | `./AGENTS.md` | 直接复制（过滤 `@import` 行） |
| OpenCode | `~/.config/opencode/AGENTS.md` | `./AGENTS.md`（与 Codex 共用） | 直接复制（过滤 `@import` 行） |
| Kiro | `~/.kiro/steering/claude-instructions.md` | `.kiro/steering/claude-instructions.md` | 加上 `inclusion: always` frontmatter |
| Cursor | 不支持（SQLite） | `.cursor/rules/claude-instructions.mdc` | 加上 `alwaysApply: true` frontmatter |

当目标文件已存在时，会询问你选择：**覆盖**、**追加**（保留原有内容 + 加上 CLAUDE.md）、或**跳过**。使用 `--on-conflict overwrite|append|skip` 可跳过交互式询问。

## 安全机制

- 已存在的 server 不会覆盖（幂等，可重复执行）
- 默认自动备份到 `~/.sync-agents-backup/`（`--no-backup` 跳过）
- `--dry-run` 预览变更，不写入任何文件

## 配置文件路径

### MCP 配置文件

| 工具 | 配置文件路径 | 格式 |
|------|------------|------|
| Claude Code（用户 MCP） | `~/.claude.json` | JSON |
| Claude Code（设置） | `~/.claude/settings.json` | JSON |
| Claude Code（插件 MCP） | `~/.claude/plugins/cache/.../.mcp.json` | JSON |
| Gemini CLI | `~/.gemini/settings.json` | JSON |
| Codex CLI（全局） | `~/.codex/config.toml` | TOML |
| Codex CLI（项目） | `.codex/config.toml`（用 `--codex-home`） | TOML |
| OpenCode（全局） | `~/.config/opencode/opencode.json` | JSON |
| Kiro CLI（全局） | `~/.kiro/settings/mcp.json` | JSON |
| Cursor（全局） | `~/.cursor/mcp.json` | JSON |

### 指令文件路径

| 工具 | 全局路径 | 项目路径 | 格式 |
|------|---------|---------|------|
| Claude Code | `~/.claude/CLAUDE.md` | `./CLAUDE.md` | Markdown |
| Gemini CLI | `~/.gemini/GEMINI.md` | `./GEMINI.md` | Markdown |
| Codex CLI | `~/.codex/AGENTS.md` | `./AGENTS.md` | Markdown |
| OpenCode | `~/.config/opencode/AGENTS.md` | `./AGENTS.md` | Markdown |
| Kiro CLI | `~/.kiro/steering/claude-instructions.md` | `.kiro/steering/claude-instructions.md` | Markdown + frontmatter |
| Cursor | 不支持（SQLite） | `.cursor/rules/claude-instructions.mdc` | MDC（Markdown + frontmatter） |

## 限制

- **OAuth servers**（如 Slack）只会同步 URL，需要在各 CLI 手动认证
- **`${CLAUDE_PLUGIN_ROOT}`** 环境变量在其他 CLI 中无法解析
- Codex CLI 不支持 URL 中的 `${VAR:-default}` 语法，同步时会自动展开
- 重复执行不会覆盖已存在的配置（安全可重复）
- 若目标配置目录不存在，会跳过该目标（不会自动创建目录）

## 许可证

MIT
