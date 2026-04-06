# Load .env from this script's directory and run claw against NVIDIA NIM.
# Usage: .\run-nim.ps1 [extra claw args...]
# Example: .\run-nim.ps1 prompt "Summarize this repo"
# Example: .\run-nim.ps1   (interactive REPL)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $here ".env"

if (-not (Test-Path $envFile)) {
    Write-Error "Missing $envFile - create it with OPENAI_API_KEY and OPENAI_BASE_URL."
}

Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $eq = $line.IndexOf("=")
    if ($eq -lt 1) { return }
    $name = $line.Substring(0, $eq).Trim()
    $value = $line.Substring($eq + 1).Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    Set-Item -Path "Env:$name" -Value $value
}

if (-not $env:HOME) { $env:HOME = $env:USERPROFILE }

# Use NIM, not Anthropic, for this session
Remove-Item Env:ANTHROPIC_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:ANTHROPIC_AUTH_TOKEN -ErrorAction SilentlyContinue

$claw = Join-Path $here "rust\target\release\claw.exe"
if (-not (Test-Path $claw)) {
    Write-Error "Build claw first: cd rust; cargo build --release"
}

$model = $env:NIM_MODEL
if (-not $model) { $model = 'ibm/granite-8b-code-instruct' }

# Chat-only: many hosted NIM models return 404 if the request includes OpenAI tool/function payloads.
# Set NIM_USE_TOOLS=1 in .env to pass tools through (full agent mode).
$nimArgs = @('--no-tools', '--model', $model)
if ($env:NIM_USE_TOOLS -eq '1' -or $env:NIM_USE_TOOLS -eq 'true') {
    $nimArgs = @('--model', $model)
}

Write-Host ("[run-nim] " + ($nimArgs -join ' ') + " ...") -ForegroundColor DarkGray

& $claw @nimArgs @args
