# sync-agents-settings

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/sync-agents-settings?logo=npm)](https://www.npmjs.com/package/sync-agents-settings)
[![npm downloads](https://img.shields.io/npm/dm/sync-agents-settings?logo=npm&label=downloads)](https://www.npmjs.com/package/sync-agents-settings)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-compatible-8A2BE2)](https://modelcontextprotocol.io/)
[![CI](https://github.com/Leoyang183/sync-agents-settings/actions/workflows/ci.yml/badge.svg)](https://github.com/Leoyang183/sync-agents-settings/actions/workflows/ci.yml)

**Claude Code**의 MCP 서버 설정을 **Gemini CLI**, **Codex CLI**, **OpenCode**, **Kiro CLI**, **Cursor**로 동기화합니다.

**다른 언어:** [🇺🇸 English](../../README.md) | [🇹🇼 繁體中文](README.zh-tw.md) | [🇨🇳 简体中文](README.zh-cn.md) | [🇯🇵 日本語](README.ja.md)

## 왜 이 도구가 필요한가

Claude Code를 주요 AI 코딩 에이전트로 사용하면서 무료 티어나 다른 모델을 활용하기 위해 다른 에이전트(Gemini CLI, Codex CLI, OpenCode, Kiro, Cursor)도 함께 사용한다면, 각 도구마다 MCP 설정 형식이 다르고 하나씩 설정하는 것이 얼마나 번거로운지 아실 겁니다.

이 도구를 사용하면 Claude Code에서 한 번만 MCP 서버를 설정하고, 하나의 명령어로 모든 대상에 동기화할 수 있습니다.

## 빠른 시작

설치 불필요 — `npx`로 바로 실행:

```bash
# Claude Code의 모든 MCP 서버 목록 보기
npx sync-agents-settings list

# 동기화 미리보기 (파일 변경 없음)
npx sync-agents-settings sync --dry-run

# 모든 대상에 동기화 (자동 백업 포함)
npx sync-agents-settings sync
```

## 설치 (선택사항)

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

# Codex 프로젝트 수준 설정에 동기화
sync-agents sync --target codex --codex-home ./my-project/.codex

# 차이점 비교
sync-agents diff

# OAuth가 필요한 서버 건너뛰기 (예: Slack)
sync-agents sync --skip-oauth

# 백업 건너뛰기
sync-agents sync --no-backup

# 상세 출력
sync-agents sync -v
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
                                                 └─→ Cursor Writer   ─→ ~/.cursor/mcp.json
```

| 단계 | 설명 |
|------|------|
| **Reader** | `~/.claude.json`과 활성화된 플러그인의 `.mcp.json`에서 읽어 통합 형식으로 변환 |
| **Gemini Writer** | JSON → JSON, `type: "http"` → `httpUrl`, `${VAR}` → `$VAR` |
| **Codex Writer** | JSON → TOML, `${VAR:-default}` → 실제 값으로 확장 |
| **OpenCode Writer** | JSON → JSON, `command`+`args` → `command` 배열로 병합, `env` → `environment`, `type: "local"`/`"remote"` |
| **Kiro Writer** | Claude와 동일한 형식, `${VAR:-default}` → 확장 |
| **Cursor Writer** | Claude와 동일한 형식, `${VAR:-default}` → 확장 |

## 안전 메커니즘

- 기존 서버는 덮어쓰지 않음 (멱등성, 재실행 가능)
- 기본적으로 `~/.sync-agents-backup/`에 자동 백업 (`--no-backup`으로 건너뛰기)
- `--dry-run`으로 파일을 변경하지 않고 변경 사항 미리보기

## 설정 파일 위치

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

## 제한 사항

- **OAuth 서버** (예: Slack)는 URL만 동기화됩니다 — 각 CLI에서 수동 인증이 필요합니다
- **`${CLAUDE_PLUGIN_ROOT}`** 환경 변수는 다른 CLI에서 해석되지 않습니다
- Codex CLI는 URL의 `${VAR:-default}` 구문을 지원하지 않습니다 — 동기화 시 자동 확장됩니다
- 재실행해도 기존 설정을 덮어쓰지 않습니다 (안전하게 반복 실행 가능)
- 대상 설정 디렉토리가 없으면 해당 대상을 건너뜁니다 (디렉토리를 생성하지 않음)

## 라이선스

MIT
