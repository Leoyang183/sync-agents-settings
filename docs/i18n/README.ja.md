# sync-agents-settings

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/sync-agents-settings?logo=npm)](https://www.npmjs.com/package/sync-agents-settings)
[![npm downloads](https://img.shields.io/npm/dm/sync-agents-settings?logo=npm&label=downloads)](https://www.npmjs.com/package/sync-agents-settings)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-compatible-8A2BE2)](https://modelcontextprotocol.io/)
[![CI](https://github.com/Leoyang183/sync-agents-settings/actions/workflows/ci.yml/badge.svg)](https://github.com/Leoyang183/sync-agents-settings/actions/workflows/ci.yml)

**Claude Code** の MCP サーバー設定と指示ファイル（CLAUDE.md）を **Gemini CLI**、**Codex CLI**、**OpenCode**、**Kiro CLI**、**Cursor**、**Kimi CLI** に同期します。

**他の言語：** [🇺🇸 English](../../README.md) | [🇹🇼 繁體中文](README.zh-tw.md) | [🇨🇳 简体中文](README.zh-cn.md) | [🇰🇷 한국어](README.ko.md)

## なぜこのツールが必要か

Claude Code をメインの AI コーディングエージェントとして使いながら、無料枠や異なるモデルを活用するために他のエージェント（Gemini CLI、Codex CLI、OpenCode、Kiro、Cursor、Kimi CLI）も使い分けている場合、各ツールの MCP 設定形式がバラバラで、一つずつ設定するのは面倒です。

指示ファイルも同じです — CLAUDE.md、GEMINI.md、AGENTS.md はすべて同じ内容が必要ですが、フォーマットが異なります。

このツールを使えば、Claude Code で一度だけ MCP サーバーの設定と指示を書き、一つのコマンドですべてのターゲットに同期できます。

## クイックスタート

### 方法 A：Claude Code Plugin（推奨）

Claude Code 内で直接 slash commands を使用：

```bash
# Plugin をロード（このセッションのみ有効）
claude --plugin-dir /path/to/sync-agents-settings

# 会話内で slash commands を使用：
#   /sync-list          — すべての MCP サーバーを一覧表示
#   /sync               — MCP 設定を同期（dry-run プレビュー付き）
#   /sync-diff           — 各エージェント間の設定差分を比較
#   /sync-instructions   — CLAUDE.md を他のエージェントに同期
```

Plugin には **sync-awareness skill** も含まれており、MCP 設定や CLAUDE.md を編集すると自動的に同期を提案します。

### 方法 B：npx で実行

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

### 方法 C：グローバルインストール

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
sync-agents sync --target kimi

# Codex のプロジェクトレベル設定に同期
sync-agents sync --target codex --codex-home ./my-project/.codex

# Kimi のプロジェクトレベル設定に同期
sync-agents sync --target kimi --kimi-home ./my-project/.kimi

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
sync-agents sync-instructions --target gemini codex kimi

# プロンプトなしで自動上書き（CI向け）
sync-agents sync-instructions --on-conflict overwrite

# 従来動作を維持: 独立行の @import を展開せずに削除
sync-agents sync-instructions --import-mode strip

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
                                                 ├─→ Cursor Writer   ─→ ~/.cursor/mcp.json
                                                 └─→ Kimi Writer     ─→ ~/.kimi/mcp.json
```

| ステージ | 説明 |
|---------|------|
| **Reader** | `~/.claude.json` と有効なプラグインの `.mcp.json` から読み取り、統一フォーマットに変換 |
| **Gemini Writer** | JSON → JSON、`type: "http"` → `httpUrl`、`${VAR}` → `$VAR` |
| **Codex Writer** | JSON → TOML、`${VAR:-default}` → 実際の値に展開 |
| **OpenCode Writer** | JSON → JSON、`command`+`args` → `command` 配列に統合、`env` → `environment`、`type: "local"`/`"remote"` |
| **Kiro Writer** | Claude と同じ形式、`${VAR:-default}` → 展開 |
| **Cursor Writer** | Claude と同じ形式、`${VAR:-default}` → 展開 |
| **Kimi Writer** | Claude と同じ形式、`${VAR:-default}` → 展開 |

### 指示ファイル同期（`sync-instructions`）

CLAUDE.md 指示ファイルを各ターゲットのネイティブフォーマットに同期します：

| ターゲット | グローバルパス | プロジェクトパス | フォーマット変換 |
|-----------|-------------|---------------|--------------|
| Gemini | `~/.gemini/GEMINI.md` | `./GEMINI.md` | そのままコピー（独立行の `@import` を展開） |
| Codex | `~/.codex/AGENTS.md` | `./AGENTS.md` | そのままコピー（独立行の `@import` を展開） |
| OpenCode | `~/.config/opencode/AGENTS.md` | `./AGENTS.md`（Codex と共有） | そのままコピー（独立行の `@import` を展開） |
| Kimi | `~/.kimi/AGENTS.md` | `./AGENTS.md`（Codex / OpenCode と共有） | そのままコピー（独立行の `@import` を展開） |
| Kiro | `~/.kiro/steering/claude-instructions.md` | `.kiro/steering/claude-instructions.md` | `inclusion: always` frontmatter を追加 |
| Cursor | 非対応（SQLite） | `.cursor/rules/claude-instructions.mdc` | `alwaysApply: true` frontmatter を追加 |

ターゲットファイルが既に存在する場合、**上書き**、**追記**（既存の内容を保持 + CLAUDE.md を追加）、または**スキップ**を選択できます。`--on-conflict overwrite|append|skip` で非対話モードにできます。

補足:
- プロジェクトソースは `./.claude/CLAUDE.md` を優先し、存在しない場合は `./CLAUDE.md` を使用します。
- `.claude/rules/**/*.md` の追加ルールは自動で取り込みます（`@import` で既に取り込まれたファイルは重複除外）。
- rule frontmatter に `paths` がある場合、プロジェクト内で 1 件以上マッチしたときだけ取り込みます。
- `@import` の既定値は `inline`（展開）です。`--import-mode strip` で独立行 `@import` を削除する方式に切り替えできます。
- Kimi CLI は現在、作業ディレクトリの `AGENTS.md` のみ読み込みます。`~/.kimi/AGENTS.md` は再利用可能なグローバルテンプレートとして同期されます。

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
| Kimi CLI（グローバル） | `~/.kimi/mcp.json` | JSON |
| Kimi CLI（プロジェクト） | `.kimi/mcp.json`（`--kimi-home ./.kimi` を使用） | JSON |

### 指示ファイルパス

| ツール | グローバルパス | プロジェクトパス | 形式 |
|--------|-------------|---------------|------|
| Claude Code | `~/.claude/CLAUDE.md` | `./.claude/CLAUDE.md`（fallback `./CLAUDE.md`） | Markdown |
| Gemini CLI | `~/.gemini/GEMINI.md` | `./GEMINI.md` | Markdown |
| Codex CLI | `~/.codex/AGENTS.md` | `./AGENTS.md` | Markdown |
| OpenCode | `~/.config/opencode/AGENTS.md` | `./AGENTS.md` | Markdown |
| Kimi CLI | `~/.kimi/AGENTS.md` | `./AGENTS.md` | Markdown |
| Kiro CLI | `~/.kiro/steering/claude-instructions.md` | `.kiro/steering/claude-instructions.md` | Markdown + frontmatter |
| Cursor | 非対応（SQLite） | `.cursor/rules/claude-instructions.mdc` | MDC（Markdown + frontmatter） |

## Claude Code Plugin

このプロジェクトは Claude Code プラグインとしても使用でき、Claude Code の会話内で直接 slash commands とコンテキスト認識 skill を提供します。

### Slash Commands

| コマンド | 説明 |
|---------|------|
| `/sync` | MCP サーバー設定を他のエージェントに同期（dry-run プレビューと確認付き） |
| `/sync-list` | Claude Code 内のすべての MCP サーバーを一覧表示 |
| `/sync-diff` | Claude と他のエージェント間の MCP 設定差分を比較 |
| `/sync-instructions` | CLAUDE.md 指示ファイルを他のエージェント形式に同期 |

### Sync-Awareness Skill

Plugin には、MCP 設定（`.claude.json`、`.mcp.json`）や `CLAUDE.md` ファイルの編集を検出すると、他のエージェントへの同期を提案する skill が含まれています。

### Plugin 開発

```bash
# Plugin 構造を検証
claude plugins validate /path/to/sync-agents-settings

# ローカルテスト（このセッションのみロード）
claude --plugin-dir /path/to/sync-agents-settings
```

## 制限事項

- **OAuth サーバー**（例：Slack）は URL のみ同期されます — 各 CLI で手動認証が必要です
- **`${CLAUDE_PLUGIN_ROOT}`** 環境変数は他の CLI では解決されません
- Codex CLI は URL 内の `${VAR:-default}` 構文をサポートしていません — 同期時に自動展開されます
- 再実行しても既存の設定は上書きされません（安全に繰り返し実行可能）
- ターゲットの設定ディレクトリが存在しない場合、そのターゲットはスキップされます（ディレクトリは作成されません）

## ライセンス

MIT
