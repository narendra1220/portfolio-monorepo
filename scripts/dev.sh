#!/usr/bin/env bash
# Bring up local infra and the portfolio dev server.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "▸ starting shared infra"
docker compose -f shared/docker/docker-compose.yml up -d redis mongo

echo "▸ installing"
npm install --no-audit --no-fund

echo "▸ portfolio dev server on http://localhost:3000"
cd apps/portfolio
exec ./node_modules/.bin/next dev
