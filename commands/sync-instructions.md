---
name: sync-instructions
description: Sync CLAUDE.md instruction files to other AI agents (Gemini, Codex, OpenCode, Kiro, Cursor, Kimi)
---

Sync CLAUDE.md instruction files from Claude Code format to other AI agent formats.

## Arguments

The user may pass target names: `/sync-instructions gemini codex`
If no targets specified, sync to all targets.

The user may also pass flags:
- `--no-backup` — skip creating backup of target instruction files
- `--import-mode inline|strip` — how to handle standalone `@import` lines (`inline` = expand, `strip` = remove line)
- `--report json` — output machine-readable JSON summary (CI-friendly)

## Execution Flow

1. Ask the user which scope to sync:
   - **Global** (`~/.claude/CLAUDE.md`) — syncs to agent-specific global instruction files
   - **Local** (`./.claude/CLAUDE.md` in current directory, fallback `./CLAUDE.md`) — syncs to project-level instruction files
   - **Both** (default) — syncs both global and local

2. Parse targets from user arguments. Build the dry-run command:
   `npx sync-agents-settings sync-instructions --dry-run [--global|--local] --target <targets>`
   Omit `--global`/`--local` if syncing both (this is the CLI default).
   Add `--no-backup` if the user specified it.

3. Run the dry-run command. Present what will be written:
   - Which instruction files will be created or updated
   - Which targets will be skipped (e.g., Cursor global is unsupported — uses SQLite)

4. If any target files already exist, ask the user what to do:
   - **Overwrite** — replace the existing file entirely
   - **Append** — add Claude instructions after the existing content
   - **Skip** — leave the existing file untouched

5. Run the actual command. IMPORTANT: Always pass `--on-conflict <action>` to prevent the CLI from entering interactive mode (which does not work in Claude Code's bash execution):
   `npx sync-agents-settings sync-instructions [--global|--local] --target <targets> --on-conflict <action>`
   Add `--no-backup` if the user specified it.

6. Present the final results: which files were synced, appended, or skipped.
   - If `--report json` is used, return raw JSON output and avoid text post-processing.

## Error Handling

- If `npx` fails: suggest `npm install -g sync-agents-settings` as fallback.
- If CLAUDE.md source file doesn't exist: the CLI will report it. Inform the user which file is missing.
- With `--report json` and non-dry-run mode, pass both `--on-conflict` and `--no-backup` to avoid interactive prompts and non-JSON logs.
