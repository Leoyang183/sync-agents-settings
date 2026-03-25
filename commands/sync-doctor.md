---
name: sync-doctor
description: Detect MCP config drift and parse errors between Claude Code and target AI agents
---

Check whether target MCP configs are in sync with Claude Code, without writing any files.

## Arguments

The user may pass target names: `/sync-doctor gemini codex`
If no targets specified, check all targets (gemini, codex, opencode, kiro, cursor, kimi).

Optional flags:
- `--skip-oauth` — ignore OAuth-only servers from Claude source
- `--codex-home <path>` — check project-level Codex config (e.g. `./.codex`)
- `--kimi-home <path>` — check project-level Kimi config (e.g. `./.kimi`)
- `--fix` — if drift exists, auto-run reconcile to add missing servers
- `--dry-run` — with `--fix`, preview only
- `--no-backup` — with `--fix`, skip backup before writing
- `--report json` — emit machine-readable JSON report

## Execution Flow

1. Parse targets and flags from user arguments.
2. Run:
   `npx sync-agents-settings doctor --target <targets>`
   Add `--skip-oauth` / `--codex-home` / `--kimi-home` when specified.
3. Present results per target:
   - `No drift` when fully in sync
   - `Missing in <target>` when Claude has servers not present in target
   - `Extra in <target>` when target has servers absent in Claude
   - `Unavailable` if target directory is missing
   - `Parse error` when target config is malformed
4. If drift exists, suggest running `/sync` to reconcile.
   - Or run `/sync-doctor --fix` to reconcile automatically.

## Error Handling

- Exit code `1` means drift detected.
- Exit code `2` means config parse error detected.
- With `--fix`, failure reasons are specific: parse-related (`target config parse error`) or validation-related (`validation errors detected`) before exiting `2`.
- If `npx` fails: suggest `npm install -g sync-agents-settings` as fallback.
- `--report json` cannot be used with `--fix` on doctor (use `reconcile --report json` instead).
