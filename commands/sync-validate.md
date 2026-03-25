---
name: sync-validate
description: Validate Claude MCP schema and target capability compatibility before syncing
---

Validate MCP server definitions from Claude Code against target agent capabilities.

## Arguments

The user may pass target names: `/sync-validate codex opencode`
If no targets are specified, validate all targets (gemini, codex, opencode, kiro, cursor, kimi).

Optional flags:
- `--skip-oauth` — ignore OAuth-only servers from validation
- `--fix` — after validation passes, auto-run reconcile
- `--dry-run` — with `--fix`, preview only
- `--no-backup` — with `--fix`, skip backup before writing
- `--report json` — emit machine-readable JSON report

## Execution Flow

1. Parse targets and flags from user arguments.
2. Run:
   `npx sync-agents-settings validate --target <targets>`
   Add `--skip-oauth` if requested.
3. Present issues grouped by target:
   - `error` issues: invalid schema that cannot be converted safely
   - `warning` issues: lossy conversion risk or manual setup needed
   - `command` / `url` with blank-only values are treated as missing and reported as `error`
   - OAuth-only servers emit `OAUTH_MANUAL_SETUP_REQUIRED` warning only (no duplicate transport-field errors)
4. If errors exist, tell the user to fix them before running `/sync`.
5. If only warnings exist, allow user to proceed based on risk tolerance.
6. If `--fix` is provided and no validation errors exist, run reconcile automatically.
   - If no drift is found, return a noop result ("Nothing to fix") instead of reporting reconcile success.

## Error Handling

- Exit code `2` means validation errors were found.
- Exit code `0` means no errors (warnings may still exist).
- With `--fix`, failure reasons are specific: parse-related (`target config parse error`) or validation-related (`validation errors detected`) before exiting `2`.
- If `npx` fails: suggest `npm install -g sync-agents-settings` as fallback.
- `--report json` cannot be used with `--fix` on validate (use `reconcile --report json` instead).
