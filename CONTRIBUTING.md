# Contributing

Thanks for your interest in contributing!

## How to Contribute

1. **Fork** this repo
2. **Clone** your fork: `git clone https://github.com/<your-username>/sync-agents-settings.git`
3. **Install** dependencies: `pnpm install`
4. **Create a branch**: `git checkout -b feat/your-feature`
5. **Make changes** and add tests
6. **Run checks**: `pnpm format:check && pnpm lint && pnpm build && pnpm test`
7. **Commit** and push to your fork
8. **Open a PR** against `main`

## Development

```bash
pnpm dev list           # Run CLI from source
pnpm test               # Run tests
pnpm test:coverage      # Run tests with coverage
pnpm lint               # ESLint
pnpm format             # Prettier auto-fix
```

## Adding a New Sync Target

1. Add config path to `src/paths.ts`
2. Add target name to `SyncTarget` in `src/types.ts`
3. Create a writer in `src/writers/` — if the target uses the same format as Claude (`mcpServers` + `command`/`args`/`env`/`url`), use `writeClaudeFormat()` from `claude-format.ts` (see `kiro.ts` or `cursor.ts` for examples)
4. Wire into `src/cli.ts` (sync action, diff command, target defaults)
5. Wire into `src/backup.ts`
6. Add unit tests in `src/__tests__/`
7. Update `README.md` and translations in `docs/i18n/`

## PR Guidelines

- All PRs are **squash merged** into a single commit
- CI must pass (format, lint, type check, build, tests)
- Keep PRs focused — one feature or fix per PR
