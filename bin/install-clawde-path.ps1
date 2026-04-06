# Adds bin\ to your user PATH so `clawde` works from any shell. Run once:
#   powershell -ExecutionPolicy Bypass -File .\bin\install-clawde-path.ps1
# Or from the repo root: .\claw-code\bin\install-clawde-path.ps1

$ErrorActionPreference = "Stop"
$binDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$binDir = (Resolve-Path $binDir).Path

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$parts = $userPath -split ";" | Where-Object { $_ -and $_.Trim() }
if ($parts -contains $binDir) {
    Write-Host "Already on PATH: $binDir" -ForegroundColor Green
    exit 0
}

$newPath = "$userPath;$binDir".TrimEnd(";")
[Environment]::SetEnvironmentVariable("Path", $newPath, "User")

Write-Host "Added to user PATH:" -ForegroundColor Green
Write-Host "  $binDir"
Write-Host ""
Write-Host "Open a new terminal, then run: clawde" -ForegroundColor DarkGray
Write-Host "If PowerShell still does not find it, run: `$env:Path = [System.Environment]::GetEnvironmentVariable('Path','User') + ';' + [System.Environment]::GetEnvironmentVariable('Path','Machine')" -ForegroundColor DarkGray
