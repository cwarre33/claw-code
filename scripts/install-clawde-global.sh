#!/usr/bin/env bash
# One-time global install; prefer: (from claw-code) bun run install-global
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
bun run scripts/install-global.ts
