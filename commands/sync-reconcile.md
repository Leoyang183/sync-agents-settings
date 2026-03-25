---
name: sync-reconcile
description: Validate + detect drift + sync only missing MCP servers in one safe flow
---

Run a safe one-shot reconcile pipeline:
1) validate schema/capability
2) detect drift
3) sync only missing servers

## Arguments

The user may pass target names: `/sync-reconcile gemini codex`
If no targets are specified, reconcile all targets.

Optional flags:
- `--dry-run` — preview only, no writes
- `--no-backup` — skip backup before write
- `--skip-oauth` — ignore OAuth-only servers
- `--codex-home <path>` — custom Codex config directory
- `--kimi-home <path>` — custom Kimi config directory
- `--report json` — emit machine-readable JSON only (for CI)

## Execution Flow

1. Build command:
   `npx sync-agents-settings reconcile --target <targets>`
   Include user-provided flags.
2. Run with `--dry-run` first if user didn't explicitly request real write.
3. Present output:
   - validation errors/warnings
   - drift summary
   - servers added/skipped per target
4. If dry-run was used and output is acceptable, ask user whether to run without `--dry-run`.
5. In automation/CI, prefer `--report json` and parse the output programmatically.

## Error Handling

- Exit code `2`: validation error or target parse error (must fix before sync).
- Exit code `0`: reconcile finished (or no drift).
- If `npx` fails: suggest `npm install -g sync-agents-settings` as fallback.
