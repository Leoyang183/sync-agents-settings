#!/usr/bin/env bash
set -euo pipefail

echo "🔍 Format check..."
pnpm format:check

echo "📝 Lint..."
pnpm lint

echo "🔎 Type check..."
npx tsc --noEmit

echo "🔨 Build..."
pnpm build

echo "🧪 Tests..."
pnpm test

echo "✅ All checks passed!"
