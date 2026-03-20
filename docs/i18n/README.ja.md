# sync-agents-settings

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/sync-agents-settings?logo=npm)](https://www.npmjs.com/package/sync-agents-settings)
[![npm downloads](https://img.shields.io/npm/dm/sync-agents-settings?logo=npm&label=downloads)](https://www.npmjs.com/package/sync-agents-settings)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-compatible-8A2BE2)](https://modelcontextprotocol.io/)
[![CI](https://github.com/Leoyang183/sync-agents-settings/actions/workflows/ci.yml/badge.svg)](https://github.com/Leoyang183/sync-agents-settings/actions/workflows/ci.yml)

**Claude Code** の MCP サーバー設定と指示ファイル（CLAUDE.md）を **Gemini CLI**、**Codex CLI**、**OpenCode**、**Kiro CLI**、**Cursor** に同期します。

**他の言語：** [🇺🇸 English](../../README.md) | [🇹🇼 繁體中文](README.zh-tw.md) | [🇨🇳 简体中文](README.zh-cn.md) | [🇰🇷 한국어](README.ko.md)

## なぜこのツールが必要か

Claude Code をメインの AI コーディングエージェントとして使いながら、無料枠や異なるモデルを活用するために他のエージェント（Gemini CLI、Codex CLI、OpenCode、Kiro、Cursor）も使い分けている場合、各ツールの MCP 設定形式がバラバラで、一つずつ設定するのは面倒です。

指示ファイルも同じです — CLAUDE.md、GEMINI.md、AGENTS.md はすべて同じ内容が必要ですが、フォーマットが異なります。

このツールを使えば、Claude Code で一度だけ MCP サーバーの設定と指示を書き、一つのコマンドですべてのターゲットに同期できます。

## クイックスタート

インストール不要 — `npx` で直接実行：

```bash
# Claude Code のすべての MCP サーバーを一覧表示
npx sync-agents-settings list

# 同期のプレビュー（ファイルは変更されません）
npx sync-agents-settings sync --dry-run

# すべてのターゲットに同期（自動バックアップ付き）
npx sync-agents-settings sync

# CLAUDE.md 指示ファイルをすべてのターゲットに同期
npx sync-agents-settings sync-instructions
```

## インストール（任意）

```bash
# グローバルインストールで sync-agents コマンドを使用
npm install -g sync-agents-settings

# 直接使用
sync-agents list
sync-agents sync
```

## 使い方

```bash
# 特定のターゲットに同期
sync-agents sync --target gemini
sync-agents sync --target codex
sync-agents sync --target opencode
sync-agents sync --target kiro
sync-agents sync --target cursor

# Codex のプロジェクトレベル設定に同期
sync-agents sync --target codex --codex-home ./my-project/.codex

# 差分を比較
sync-agents diff

# OAuth が必要なサーバーをスキップ（例：Slack）
sync-agents sync --skip-oauth

# バックアップをスキップ
sync-agents sync --no-backup

# 詳細出力
sync-agents sync -v

# 指示ファイルを同期（CLAUDE.md → GEMINI.md / AGENTS.md / Kiro steering / Cursor rules）
sync-agents sync-instructions

# グローバル指示のみ同期
sync-agents sync-instructions --global

# プロジェクトレベル指示のみ同期
sync-agents sync-instructions --local

# 特定のターゲットに同期
sync-agents sync-instructions --target gemini codex

# プロンプトなしで自動上書き（CI向け）
sync-agents sync-instructions --on-conflict overwrite

# 指示同期のプレビュー
sync-agents sync-instructions --dry-run
```

## 仕組み

**Claude Code が MCP 設定の Single Source of Truth** であり、すべてのサポートされたターゲットに同期します。

```
                                                 ┌─→ Gemini Writer   ─→ ~/.gemini/settings.json
                                                 ├─→ Codex Writer    ─→ ~/.codex/config.toml
~/.claude.json ─────┐                            │
                     ├─→ Reader ─→ UnifiedMcpServer[] ─┼─→ OpenCode Writer ─→ ~/.config/opencode/opencode.json
~/.claude/plugins/ ──┘                            │
                                                 ├─→ Kiro Writer     ─→ ~/.kiro/settings/mcp.json
                                                 └─→ Cursor Writer   ─→ ~/.cursor/mcp.json
```

| ステージ | 説明 |
|---------|------|
| **Reader** | `~/.claude.json` と有効なプラグインの `.mcp.json` から読み取り、統一フォーマットに変換 |
| **Gemini Writer** | JSON → JSON、`type: "http"` → `httpUrl`、`${VAR}` → `$VAR` |
| **Codex Writer** | JSON → TOML、`${VAR:-default}` → 実際の値に展開 |
| **OpenCode Writer** | JSON → JSON、`command`+`args` → `command` 配列に統合、`env` → `environment`、`type: "local"`/`"remote"` |
| **Kiro Writer** | Claude と同じ形式、`${VAR:-default}` → 展開 |
| **Cursor Writer** | Claude と同じ形式、`${VAR:-default}` → 展開 |

### 指示ファイル同期（`sync-instructions`）

CLAUDE.md 指示ファイルを各ターゲットのネイティブフォーマットに同期します：

| ターゲット | グローバルパス | プロジェクトパス | フォーマット変換 |
|-----------|-------------|---------------|--------------|
| Gemini | `~/.gemini/GEMINI.md` | `./GEMINI.md` | そのままコピー（`@import` 行をフィルター） |
| Codex | `~/.codex/AGENTS.md` | `./AGENTS.md` | そのままコピー（`@import` 行をフィルター） |
| OpenCode | `~/.config/opencode/AGENTS.md` | `./AGENTS.md`（Codex と共有） | そのままコピー（`@import` 行をフィルター） |
| Kiro | `~/.kiro/steering/claude-instructions.md` | `.kiro/steering/claude-instructions.md` | `inclusion: always` frontmatter を追加 |
| Cursor | 非対応（SQLite） | `.cursor/rules/claude-instructions.mdc` | `alwaysApply: true` frontmatter を追加 |

ターゲットファイルが既に存在する場合、**上書き**、**追記**（既存の内容を保持 + CLAUDE.md を追加）、または**スキップ**を選択できます。`--on-conflict overwrite|append|skip` で非対話モードにできます。

## 安全機能

- 既存のサーバーは上書きされません（べき等、再実行可能）
- デフォルトで `~/.sync-agents-backup/` に自動バックアップ（`--no-backup` でスキップ）
- `--dry-run` でファイルを変更せずに変更内容をプレビュー

## 設定ファイルの場所

### MCP 設定ファイル

| ツール | 設定ファイルパス | 形式 |
|--------|----------------|------|
| Claude Code（ユーザー MCP） | `~/.claude.json` | JSON |
| Claude Code（設定） | `~/.claude/settings.json` | JSON |
| Claude Code（プラグイン MCP） | `~/.claude/plugins/cache/.../.mcp.json` | JSON |
| Gemini CLI | `~/.gemini/settings.json` | JSON |
| Codex CLI（グローバル） | `~/.codex/config.toml` | TOML |
| Codex CLI（プロジェクト） | `.codex/config.toml`（`--codex-home` を使用） | TOML |
| OpenCode（グローバル） | `~/.config/opencode/opencode.json` | JSON |
| Kiro CLI（グローバル） | `~/.kiro/settings/mcp.json` | JSON |
| Cursor（グローバル） | `~/.cursor/mcp.json` | JSON |

### 指示ファイルパス

| ツール | グローバルパス | プロジェクトパス | 形式 |
|--------|-------------|---------------|------|
| Claude Code | `~/.claude/CLAUDE.md` | `./CLAUDE.md` | Markdown |
| Gemini CLI | `~/.gemini/GEMINI.md` | `./GEMINI.md` | Markdown |
| Codex CLI | `~/.codex/AGENTS.md` | `./AGENTS.md` | Markdown |
| OpenCode | `~/.config/opencode/AGENTS.md` | `./AGENTS.md` | Markdown |
| Kiro CLI | `~/.kiro/steering/claude-instructions.md` | `.kiro/steering/claude-instructions.md` | Markdown + frontmatter |
| Cursor | 非対応（SQLite） | `.cursor/rules/claude-instructions.mdc` | MDC（Markdown + frontmatter） |

## 制限事項

- **OAuth サーバー**（例：Slack）は URL のみ同期されます — 各 CLI で手動認証が必要です
- **`${CLAUDE_PLUGIN_ROOT}`** 環境変数は他の CLI では解決されません
- Codex CLI は URL 内の `${VAR:-default}` 構文をサポートしていません — 同期時に自動展開されます
- 再実行しても既存の設定は上書きされません（安全に繰り返し実行可能）
- ターゲットの設定ディレクトリが存在しない場合、そのターゲットはスキップされます（ディレクトリは作成されません）

## ライセンス

MIT
