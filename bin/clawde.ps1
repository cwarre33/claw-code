# Same as clawde.cmd; for PowerShell-native invocation when PATH includes this directory.
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $dir "..\run-nim.ps1") @args
