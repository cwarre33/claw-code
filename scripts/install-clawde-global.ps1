# One-time: install the `clawde` CLI globally via Bun (pack + bun install -g).
# Prefer:  from `claw-code` root run:  bun run install-global
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
Push-Location $repoRoot
try {
  bun run scripts/install-global.ts
} finally {
  Pop-Location
}
