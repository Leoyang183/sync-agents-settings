# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm build              # Compile TypeScript (src/ → dist/)
pnpm test               # Run all tests (vitest)
pnpm test:coverage      # Run tests with v8 coverage report
pnpm lint               # ESLint check
pnpm format:check       # Prettier check
pnpm format             # Prettier auto-fix
pnpm dev list           # Run CLI from source (tsx)
```

Run a single test file:
```bash
npx vitest run src/__tests__/codex-writer.test.ts
```

## Architecture

This is a CLI tool that reads MCP server configurations from Claude Code and writes them to other AI coding agents in their native formats.

**Data flow:**
```
Reader (src/reader.ts)
  → reads ~/.claude.json + enabled plugin .mcp.json files
  → produces UnifiedMcpServer[]

Writers (src/writers/*.ts)
  → each writer converts UnifiedMcpServer[] to target-specific format
  → writes to target config file
```

**Writer patterns — three categories:**

1. **Claude-format targets** (Kiro, Cursor): Use shared `claude-format.ts` — same `mcpServers` JSON format as Claude, just different file paths. Each writer is ~10 lines delegating to `writeClaudeFormat()`.

2. **Custom JSON targets** (Gemini, OpenCode): Own writer with format-specific conversion (`httpUrl`, `type: "local"/"remote"`, `environment` vs `env`).

3. **TOML target** (Codex): Converts JSON to TOML via `@iarna/toml`.

**Adding a new target that uses Claude's format:** Create a one-liner writer like `kiro.ts`/`cursor.ts`, add path to `paths.ts`, add target name to `SyncTarget` union in `types.ts`, wire into `cli.ts` and `backup.ts`.

**Instruction sync (`sync-instructions` command):**

```
src/instructions.ts
  → reads CLAUDE.md (global or local)
  → filterClaudeSpecificSyntax() removes @import lines
  → optional transform: wrapForKiro() or wrapForCursor() adds frontmatter
  → writes to target instruction file

src/prompt.ts
  → askConflictAction() interactive prompt when target file exists
  → options: overwrite / append / skip
```

**Key modules:**
- `src/env.ts` — `expandEnvVars()` resolves `${VAR:-default}` syntax for targets that don't support it (Codex, OpenCode, Kiro, Cursor)
- `src/backup.ts` — copies all affected config files to `~/.sync-agents-backup/<timestamp>/` before writing
- `src/paths.ts` — centralized config file paths for all targets (MCP + instruction paths)
- `src/instructions.ts` — instruction file sync logic with source caching and transform pipeline
- `src/prompt.ts` — interactive conflict resolution (overwrite/append/skip)

## Testing

- Unit tests mock `node:fs` with `vi.mock("node:fs")` — no real filesystem access
- E2E tests (`e2e.test.ts`) create a fake `HOME` directory in `/tmp` and run the CLI via `execFileSync`
- `vitest.config.ts` scopes tests to `src/__tests__/` to avoid running compiled `dist/` duplicates

## Publishing

Published to npm as `sync-agents-settings`. The `bin` entry uses a CJS wrapper (`bin/sync-agents.cjs`) that dynamically imports the ESM `dist/cli.js` — this is required for `npx` compatibility with ESM packages.
