# sync-agents-settings

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/sync-agents-settings?logo=npm)](https://www.npmjs.com/package/sync-agents-settings)
[![npm downloads](https://img.shields.io/npm/dm/sync-agents-settings?logo=npm&label=downloads)](https://www.npmjs.com/package/sync-agents-settings)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-compatible-8A2BE2)](https://modelcontextprotocol.io/)
[![CI](https://github.com/Leoyang183/sync-agents-settings/actions/workflows/ci.yml/badge.svg)](https://github.com/Leoyang183/sync-agents-settings/actions/workflows/ci.yml)

**Claude Code**의 MCP 서버 설정과 지시 파일(CLAUDE.md)을 **Gemini CLI**, **Codex CLI**, **OpenCode**, **Kiro CLI**, **Cursor**, **Kimi CLI**로 동기화합니다.

**다른 언어:** [🇺🇸 English](../../README.md) | [🇹🇼 繁體中文](README.zh-tw.md) | [🇨🇳 简体中文](README.zh-cn.md) | [🇯🇵 日本語](README.ja.md)
**지원 매트릭스:** [CLI 호환성 매트릭스](../compatibility-matrix.md)

## 왜 이 도구가 필요한가

Claude Code를 주요 AI 코딩 에이전트로 사용하면서 무료 티어나 다른 모델을 활용하기 위해 다른 에이전트(Gemini CLI, Codex CLI, OpenCode, Kiro, Cursor, Kimi CLI)도 함께 사용한다면, 각 도구마다 MCP 설정 형식이 다르고 하나씩 설정하는 것이 얼마나 번거로운지 아실 겁니다.

지시 파일도 마찬가지입니다 — CLAUDE.md, GEMINI.md, AGENTS.md 모두 같은 내용이 필요하지만 형식이 다릅니다.

이 도구를 사용하면 Claude Code에서 한 번만 MCP 서버를 설정하고 지시를 작성하면, 하나의 명령어로 모든 대상에 동기화할 수 있습니다.

## 빠른 시작

### 방법 A: Claude Code Plugin (권장)

Claude Code에서 직접 slash commands 사용:

```bash
# Plugin 로드 (이번 세션만 유효)
claude --plugin-dir /path/to/sync-agents-settings

# 대화에서 slash commands 사용:
#   /sync-list          — 모든 MCP 서버 목록 보기
#   /sync               — MCP 설정 동기화 (dry-run 미리보기 포함)
#   /sync-diff           — 각 에이전트 간 설정 차이 비교
#   /sync-instructions   — CLAUDE.md를 다른 에이전트에 동기화
```

Plugin에는 **sync-awareness skill**이 포함되어 있어 MCP 설정이나 CLAUDE.md를 편집할 때 자동으로 동기화를 제안합니다.

### 방법 B: npx로 실행

설치 불필요 — `npx`로 바로 실행:

```bash
# Claude Code의 모든 MCP 서버 목록 보기
npx sync-agents-settings list

# 동기화 미리보기 (파일 변경 없음)
npx sync-agents-settings sync --dry-run

# 모든 대상에 동기화 (자동 백업 포함)
npx sync-agents-settings sync

# CLAUDE.md 지시 파일을 모든 대상에 동기화
npx sync-agents-settings sync-instructions
```

### 방법 C: 글로벌 설치

```bash
# 글로벌 설치로 sync-agents 명령어 사용
npm install -g sync-agents-settings

# 직접 사용
sync-agents list
sync-agents sync
```

## 사용법

```bash
# 특정 대상에 동기화
sync-agents sync --target gemini
sync-agents sync --target codex
sync-agents sync --target opencode
sync-agents sync --target kiro
sync-agents sync --target cursor
sync-agents sync --target kimi

# Codex 프로젝트 수준 설정에 동기화
sync-agents sync --target codex --codex-home ./my-project/.codex

# Kimi 프로젝트 수준 설정에 동기화
sync-agents sync --target kimi --kimi-home ./my-project/.kimi

# 차이점 비교
sync-agents diff

# OAuth가 필요한 서버 건너뛰기 (예: Slack)
sync-agents sync --skip-oauth

# 백업 건너뛰기
sync-agents sync --no-backup

# 상세 출력
sync-agents sync -v

# 지시 파일 동기화 (CLAUDE.md → GEMINI.md / AGENTS.md / Kiro steering / Cursor rules)
sync-agents sync-instructions

# 글로벌 지시만 동기화
sync-agents sync-instructions --global

# 프로젝트 수준 지시만 동기화
sync-agents sync-instructions --local

# 특정 대상에 동기화
sync-agents sync-instructions --target gemini codex kimi

# 프롬프트 없이 자동 덮어쓰기 (CI용)
sync-agents sync-instructions --on-conflict overwrite

# 기존 동작 유지: 독립 라인 @import를 확장하지 않고 제거
sync-agents sync-instructions --import-mode strip

# 현재 프로젝트 루트 밖 파일도 독립 라인 @import로 읽기 허용 (주의해서 사용)
sync-agents sync-instructions --allow-unsafe-imports

# 지시 동기화 미리보기
sync-agents sync-instructions --dry-run
```

## 작동 원리

**Claude Code가 MCP 설정의 Single Source of Truth**이며, 지원되는 모든 대상에 동기화됩니다.

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

| 단계 | 설명 |
|------|------|
| **Reader** | `~/.claude.json`과 활성화된 플러그인의 `.mcp.json`에서 읽어 통합 형식으로 변환 |
| **Gemini Writer** | JSON → JSON, `type: "http"` → `httpUrl`, `${VAR}` → `$VAR` |
| **Codex Writer** | JSON → TOML, `${VAR:-default}` → 실제 값으로 확장 |
| **OpenCode Writer** | JSON → JSON, `command`+`args` → `command` 배열로 병합, `env` → `environment`, `type: "local"`/`"remote"` |
| **Kiro Writer** | Claude와 동일한 형식, `${VAR:-default}` → 확장 |
| **Cursor Writer** | Claude와 동일한 형식, `${VAR:-default}` → 확장 |
| **Kimi Writer** | Claude와 동일한 형식, `${VAR:-default}` → 확장 |

### 지시 파일 동기화 (`sync-instructions`)

CLAUDE.md 지시 파일을 각 대상의 네이티브 형식으로 동기화합니다:

| 대상 | 글로벌 경로 | 프로젝트 경로 | 형식 변환 |
|------|-----------|-------------|---------|
| Gemini | `~/.gemini/GEMINI.md` | `./GEMINI.md` | 그대로 복사 (독립 라인 `@import` 확장) |
| Codex | `~/.codex/AGENTS.md` | `./AGENTS.md` | 그대로 복사 (독립 라인 `@import` 확장) |
| OpenCode | `~/.config/opencode/AGENTS.md` | `./AGENTS.md` (Codex와 공유) | 그대로 복사 (독립 라인 `@import` 확장) |
| Kimi | `~/.kimi/AGENTS.md` | `./AGENTS.md` (Codex / OpenCode와 공유) | 그대로 복사 (독립 라인 `@import` 확장) |
| Kiro | `~/.kiro/steering/claude-instructions.md` | `.kiro/steering/claude-instructions.md` | `inclusion: always` frontmatter 추가 |
| Cursor | 미지원 (SQLite) | `.cursor/rules/claude-instructions.mdc` | `alwaysApply: true` frontmatter 추가 |

대상 파일이 이미 존재하는 경우, **덮어쓰기**, **추가** (기존 내용 유지 + CLAUDE.md 추가), 또는 **건너뛰기**를 선택할 수 있습니다. `--on-conflict overwrite|append|skip`으로 비대화형 모드를 사용할 수 있습니다.

참고:
- 프로젝트 소스는 `./.claude/CLAUDE.md`를 우선 사용하고, 없으면 `./CLAUDE.md`를 사용합니다.
- `.claude/rules/**/*.md`의 추가 규칙은 자동으로 병합됩니다 (`@import`로 이미 포함된 파일은 중복 제외).
- rule frontmatter에 `paths`가 있으면, 프로젝트 파일 중 하나 이상이 매칭될 때만 포함됩니다.
- `@import` 기본값은 `inline`(확장)이며, `--import-mode strip`으로 독립 라인 `@import` 제거 방식으로 전환할 수 있습니다.
- 기본값에서는 독립 라인 `@import`가 현재 프로젝트 루트 내부 파일만 읽을 수 있습니다. 제한을 해제하려면 `--allow-unsafe-imports`를 사용하세요.
- 인라인 확장에는 안전 상한이 있습니다(최대 깊이 20, 최대 파일 수 200)로 무한/과도한 재귀를 방지합니다.
- Kimi CLI는 현재 작업 디렉토리의 `AGENTS.md`만 읽습니다. `~/.kimi/AGENTS.md`는 재사용 가능한 글로벌 템플릿으로 동기화됩니다.

## 안전 메커니즘

- 기존 서버는 덮어쓰지 않음 (멱등성, 재실행 가능)
- 기본적으로 `~/.sync-agents-backup/`에 자동 백업 (`--no-backup`으로 건너뛰기)
- `--dry-run`으로 파일을 변경하지 않고 변경 사항 미리보기

## 설정 파일 위치

### MCP 설정 파일

| 도구 | 설정 파일 경로 | 형식 |
|------|--------------|------|
| Claude Code (사용자 MCP) | `~/.claude.json` | JSON |
| Claude Code (설정) | `~/.claude/settings.json` | JSON |
| Claude Code (플러그인 MCP) | `~/.claude/plugins/cache/.../.mcp.json` | JSON |
| Gemini CLI | `~/.gemini/settings.json` | JSON |
| Codex CLI (글로벌) | `~/.codex/config.toml` | TOML |
| Codex CLI (프로젝트) | `.codex/config.toml` (`--codex-home` 사용) | TOML |
| OpenCode (글로벌) | `~/.config/opencode/opencode.json` | JSON |
| Kiro CLI (글로벌) | `~/.kiro/settings/mcp.json` | JSON |
| Cursor (글로벌) | `~/.cursor/mcp.json` | JSON |
| Kimi CLI (글로벌) | `~/.kimi/mcp.json` | JSON |
| Kimi CLI (프로젝트) | `.kimi/mcp.json` (`--kimi-home ./.kimi` 사용) | JSON |

### 지시 파일 경로

| 도구 | 글로벌 경로 | 프로젝트 경로 | 형식 |
|------|-----------|-------------|------|
| Claude Code | `~/.claude/CLAUDE.md` | `./.claude/CLAUDE.md` (fallback `./CLAUDE.md`) | Markdown |
| Gemini CLI | `~/.gemini/GEMINI.md` | `./GEMINI.md` | Markdown |
| Codex CLI | `~/.codex/AGENTS.md` | `./AGENTS.md` | Markdown |
| OpenCode | `~/.config/opencode/AGENTS.md` | `./AGENTS.md` | Markdown |
| Kimi CLI | `~/.kimi/AGENTS.md` | `./AGENTS.md` | Markdown |
| Kiro CLI | `~/.kiro/steering/claude-instructions.md` | `.kiro/steering/claude-instructions.md` | Markdown + frontmatter |
| Cursor | 미지원 (SQLite) | `.cursor/rules/claude-instructions.mdc` | MDC (Markdown + frontmatter) |

## Claude Code Plugin

이 프로젝트는 Claude Code 플러그인으로도 사용할 수 있으며, Claude Code 대화에서 직접 slash commands와 컨텍스트 인식 skill을 제공합니다.

### Slash Commands

| 명령어 | 설명 |
|--------|------|
| `/sync` | MCP 서버 설정을 다른 에이전트에 동기화 (dry-run 미리보기 및 확인 포함) |
| `/sync-list` | Claude Code의 모든 MCP 서버 목록 표시 |
| `/sync-diff` | Claude와 다른 에이전트 간 MCP 설정 차이 비교 |
| `/sync-instructions` | CLAUDE.md 지시 파일을 다른 에이전트 형식으로 동기화 |

### Sync-Awareness Skill

Plugin에는 MCP 설정(`.claude.json`, `.mcp.json`)이나 `CLAUDE.md` 파일 편집을 감지하면 다른 에이전트에 동기화를 제안하는 skill이 포함되어 있습니다.

### Plugin 개발

```bash
# Plugin 구조 검증
claude plugins validate /path/to/sync-agents-settings

# 로컬 테스트 (이번 세션만 로드)
claude --plugin-dir /path/to/sync-agents-settings
```

## 제한 사항

- **OAuth 서버** (예: Slack)는 URL만 동기화됩니다 — 각 CLI에서 수동 인증이 필요합니다
- **`${CLAUDE_PLUGIN_ROOT}`** 환경 변수는 다른 CLI에서 해석되지 않습니다
- Codex CLI는 URL의 `${VAR:-default}` 구문을 지원하지 않습니다 — 동기화 시 자동 확장됩니다
- 재실행해도 기존 설정을 덮어쓰지 않습니다 (안전하게 반복 실행 가능)
- 대상 설정 디렉토리가 없으면 해당 대상을 건너뜁니다 (디렉토리를 생성하지 않음)

## 라이선스

MIT
