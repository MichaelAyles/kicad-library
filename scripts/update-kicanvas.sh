#!/usr/bin/env bash
# Rebuild public/kicanvas/kicanvas.js from a local checkout of the KiCanvas fork.
# Usage: scripts/update-kicanvas.sh [path-to-kicanvas-checkout]
set -euo pipefail

KC_DIR="${1:-../kicanvas}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$KC_DIR"
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "KiCanvas checkout has uncommitted changes; commit or stash first." >&2
  exit 1
fi

npm ci --no-audit --no-fund
npm run lint:types
npm test
npm run build

cp build/kicanvas.js build/esbuild-meta.json "$APP_DIR/public/kicanvas/"
echo "Copied bundle from $(git rev-parse --abbrev-ref HEAD)@$(git rev-parse --short HEAD)."
echo "Update public/kicanvas/SOURCE.md with that branch and commit."
