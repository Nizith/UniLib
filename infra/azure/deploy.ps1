# Windows helper: runs the bash deploy script (requires Git Bash or WSL with bash + Azure CLI).
# Recommended: use Azure Cloud Shell (bash) from the portal and run: bash infra/azure/deploy.sh

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $RepoRoot

if (Get-Command wsl.exe -ErrorAction SilentlyContinue) {
  wsl.exe bash ./infra/azure/deploy.sh @args
  exit $LASTEXITCODE
}
if (Get-Command bash.exe -ErrorAction SilentlyContinue) {
  bash.exe ./infra/azure/deploy.sh @args
  exit $LASTEXITCODE
}

Write-Host "No bash found. Options:"
Write-Host "  1) Install WSL + Ubuntu, install Azure CLI in WSL, then: wsl bash infra/azure/deploy.sh"
Write-Host "  2) Open Azure Portal -> Cloud Shell (Bash), upload or git clone the repo, run: bash infra/azure/deploy.sh"
exit 1
