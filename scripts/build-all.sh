#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "▸ install"
npm install --no-audit --no-fund

echo "▸ job-queue (tsc)"
( cd apps/job-queue && ./node_modules/.bin/tsc )

echo "▸ portfolio (next build)"
( cd apps/portfolio && ./node_modules/.bin/next build )

echo "✓ done"
