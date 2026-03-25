# Repository Guidelines

## Project Structure & Module Organization
- Core source lives in `src/`.
- CLI entrypoint: `src/cli.ts`.
- MCP sync logic is split by concern:
  - readers: `src/reader.ts`
  - writers: `src/writers/*.ts` (target-specific adapters)
  - validation/health: `src/validation.ts`, `src/doctor.ts`, `src/reconcile.ts`, `src/fix.ts`
  - instruction sync: `src/instructions.ts`
- Tests are in `src/__tests__/` (unit + workflow-level tests).
- User docs live in `README.md` and localized variants under `docs/i18n/`.
- Command docs for Claude plugin are in `commands/`.

## Build, Test, and Development Commands
- `pnpm dev <command>`: run CLI from source (example: `pnpm dev sync -- --dry-run`).
- `pnpm build`: compile TypeScript to `dist/`.
- `pnpm test`: run full Vitest suite.
- `pnpm lint`: run ESLint on `src/`.
- `pnpm format` / `pnpm format:check`: format or verify formatting.
- `./ci-local.sh`: quick local CI-style check.

## Coding Style & Naming Conventions
- Language: TypeScript (ESM).
- Indentation: 2 spaces; keep files UTF-8 and newline-terminated.
- Prefer small, single-purpose modules and explicit types for public functions.
- Naming:
  - files: kebab/lowercase (`report-parser.ts`, `claude-format.ts`)
  - functions/variables: `camelCase`
  - types/interfaces: `PascalCase`
- Follow existing formatter/linter behavior (`prettier`, `eslint`).

## Testing Guidelines
- Framework: Vitest (`vitest.config.ts`).
- Add/adjust tests in `src/__tests__/` for every behavior change.
- Test names should describe behavior (e.g., `it("skips existing servers")`).
- Run focused tests during development: `pnpm vitest run src/__tests__/foo.test.ts`.
- Keep deterministic tests; avoid network/runtime dependencies.

## Commit & Pull Request Guidelines
- Follow Conventional Commits as used in history: `feat:`, `fix:`, `docs:`, `test:`, `chore:`.
- Keep commits scoped and atomic (code + tests + docs for that change).
- PRs should include:
  - what changed and why
  - affected commands/targets (e.g., `gemini`, `codex`, `kimi`)
  - verification steps and command outputs
  - linked issue (if applicable)

## Security & Configuration Tips
- Never commit secrets or real tokens.
- Use `--dry-run` before write operations.
- Validate/report modes (`--report json`) are preferred for CI and automation.
