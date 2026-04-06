@echo off
REM Global launcher for claw + NVIDIA NIM (run-nim.ps1). Add this folder to %PATH% (see install-clawde-path.ps1).
setlocal
set "SCRIPT_DIR=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%..\run-nim.ps1" %*
