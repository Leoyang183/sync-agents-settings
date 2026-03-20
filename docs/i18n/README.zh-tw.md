# sync-agents-settings

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/sync-agents-settings?logo=npm)](https://www.npmjs.com/package/sync-agents-settings)
[![npm downloads](https://img.shields.io/npm/dm/sync-agents-settings?logo=npm&label=downloads)](https://www.npmjs.com/package/sync-agents-settings)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-compatible-8A2BE2)](https://modelcontextprotocol.io/)
[![CI](https://github.com/Leoyang183/sync-agents-settings/actions/workflows/ci.yml/badge.svg)](https://github.com/Leoyang183/sync-agents-settings/actions/workflows/ci.yml)

將 **Claude Code** 的 MCP server 設定和指令檔（CLAUDE.md）同步到 **Gemini CLI**、**Codex CLI**、**OpenCode**、**Kiro CLI** 和 **Cursor**。

**其他語言：** [🇺🇸 English](../../README.md) | [🇨🇳 简体中文](README.zh-cn.md) | [🇯🇵 日本語](README.ja.md) | [🇰🇷 한국어](README.ko.md)

## 為什麼需要這個工具

如果你主要用 Claude Code 開發，但也會切換其他 AI agent（Gemini CLI、Codex CLI、OpenCode、Kiro、Cursor）來善用各家的免費額度或不同模型，你一定知道這個痛點 — 每個工具的 MCP 設定格式都不一樣，一個一個設定實在太累。指令檔也是一樣 — CLAUDE.md、GEMINI.md、AGENTS.md 都需要同樣的內容，但格式各不相同。

這個工具讓你只在 Claude Code 設定一次 MCP servers 和撰寫指令，一行指令同步到所有目標。

## 快速開始

不需安裝，直接用 `npx`：

```bash
# 列出所有 Claude Code 的 MCP servers
npx sync-agents-settings list

# 預覽同步（不修改任何檔案）
npx sync-agents-settings sync --dry-run

# 同步到所有目標（自動備份）
npx sync-agents-settings sync

# 同步 CLAUDE.md 指令檔到所有目標
npx sync-agents-settings sync-instructions
```

## 安裝（選用）

```bash
# 全域安裝，使用 sync-agents 指令
npm install -g sync-agents-settings

# 直接使用
sync-agents list
sync-agents sync
```

## 使用方式

```bash
# 同步到特定目標
sync-agents sync --target gemini
sync-agents sync --target codex
sync-agents sync --target opencode
sync-agents sync --target kiro
sync-agents sync --target cursor

# 同步到 Codex 專案層級設定
sync-agents sync --target codex --codex-home ./my-project/.codex

# 比較差異
sync-agents diff

# 跳過需要 OAuth 的伺服器（如 Slack）
sync-agents sync --skip-oauth

# 跳過備份
sync-agents sync --no-backup

# 詳細輸出
sync-agents sync -v

# 同步指令檔（CLAUDE.md → GEMINI.md / AGENTS.md / Kiro steering / Cursor rules）
sync-agents sync-instructions

# 只同步全域指令
sync-agents sync-instructions --global

# 只同步專案層級指令
sync-agents sync-instructions --local

# 同步到特定目標
sync-agents sync-instructions --target gemini codex

# 自動覆蓋不詢問（適用於 CI）
sync-agents sync-instructions --on-conflict overwrite

# 預覽指令同步
sync-agents sync-instructions --dry-run
```

## 運作原理

**Claude Code 是 MCP 設定的 single source of truth**，同步到所有支援的目標。

```
                                                 ┌─→ Gemini Writer   ─→ ~/.gemini/settings.json
                                                 ├─→ Codex Writer    ─→ ~/.codex/config.toml
~/.claude.json ─────┐                            │
                     ├─→ Reader ─→ UnifiedMcpServer[] ─┼─→ OpenCode Writer ─→ ~/.config/opencode/opencode.json
~/.claude/plugins/ ──┘                            │
                                                 ├─→ Kiro Writer     ─→ ~/.kiro/settings/mcp.json
                                                 └─→ Cursor Writer   ─→ ~/.cursor/mcp.json
```

| 階段 | 說明 |
|------|------|
| **Reader** | 從 `~/.claude.json` 和已啟用 plugin 的 `.mcp.json` 讀取，合併為統一格式 |
| **Gemini Writer** | JSON → JSON，`type: "http"` → `httpUrl`，`${VAR}` → `$VAR` |
| **Codex Writer** | JSON → TOML，`${VAR:-default}` → 展開為實際值 |
| **OpenCode Writer** | JSON → JSON，`command`+`args` → 合併為 `command` 陣列，`env` → `environment`，`type: "local"`/`"remote"` |
| **Kiro Writer** | 與 Claude 相同格式，`${VAR:-default}` → 展開 |
| **Cursor Writer** | 與 Claude 相同格式，`${VAR:-default}` → 展開 |

### 指令檔同步（`sync-instructions`）

將 CLAUDE.md 指令檔同步到各目標的原生格式：

| 目標 | 全域路徑 | 專案路徑 | 格式轉換 |
|------|---------|---------|---------|
| Gemini | `~/.gemini/GEMINI.md` | `./GEMINI.md` | 直接複製（過濾 `@import` 行） |
| Codex | `~/.codex/AGENTS.md` | `./AGENTS.md` | 直接複製（過濾 `@import` 行） |
| OpenCode | `~/.config/opencode/AGENTS.md` | `./AGENTS.md`（與 Codex 共用） | 直接複製（過濾 `@import` 行） |
| Kiro | `~/.kiro/steering/claude-instructions.md` | `.kiro/steering/claude-instructions.md` | 加上 `inclusion: always` frontmatter |
| Cursor | 不支援（SQLite） | `.cursor/rules/claude-instructions.mdc` | 加上 `alwaysApply: true` frontmatter |

當目標檔案已存在時，會詢問你選擇：**覆蓋**、**附加**（保留原有內容 + 加上 CLAUDE.md）、或**跳過**。使用 `--on-conflict overwrite|append|skip` 可跳過互動式詢問。

## 安全機制

- 已存在的 server 不會覆蓋（idempotent，可重複執行）
- 預設自動備份到 `~/.sync-agents-backup/`（`--no-backup` 跳過）
- `--dry-run` 預覽變更，不寫入任何檔案

## 設定檔路徑

| 工具 | 設定檔路徑 | 格式 |
|------|-----------|------|
| Claude Code（使用者 MCP） | `~/.claude.json` | JSON |
| Claude Code（設定） | `~/.claude/settings.json` | JSON |
| Claude Code（plugin MCP） | `~/.claude/plugins/cache/.../.mcp.json` | JSON |
| Gemini CLI | `~/.gemini/settings.json` | JSON |
| Codex CLI（全域） | `~/.codex/config.toml` | TOML |
| Codex CLI（專案） | `.codex/config.toml`（用 `--codex-home`） | TOML |
| OpenCode（全域） | `~/.config/opencode/opencode.json` | JSON |
| Kiro CLI（全域） | `~/.kiro/settings/mcp.json` | JSON |
| Cursor（全域） | `~/.cursor/mcp.json` | JSON |

### 指令檔路徑

| 工具 | 全域路徑 | 專案路徑 | 格式 |
|------|---------|---------|------|
| Claude Code | `~/.claude/CLAUDE.md` | `./CLAUDE.md` | Markdown |
| Gemini CLI | `~/.gemini/GEMINI.md` | `./GEMINI.md` | Markdown |
| Codex CLI | `~/.codex/AGENTS.md` | `./AGENTS.md` | Markdown |
| OpenCode | `~/.config/opencode/AGENTS.md` | `./AGENTS.md` | Markdown |
| Kiro CLI | `~/.kiro/steering/claude-instructions.md` | `.kiro/steering/claude-instructions.md` | Markdown + frontmatter |
| Cursor | 不支援（SQLite） | `.cursor/rules/claude-instructions.mdc` | MDC（Markdown + frontmatter） |

## 限制

- **OAuth servers**（如 Slack）只會同步 URL，需要在各 CLI 手動認證
- **`${CLAUDE_PLUGIN_ROOT}`** 環境變數在其他 CLI 中無法解析
- Codex CLI 不支援 URL 中的 `${VAR:-default}` 語法，同步時會自動展開
- 重複執行不會覆蓋已存在的設定（安全可重複）
- 若目標設定目錄不存在，會跳過該目標（不會自動建立目錄）

## 授權

MIT
