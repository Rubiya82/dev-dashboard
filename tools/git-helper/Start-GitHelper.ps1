param([string]$RepoRoot = (Join-Path $PSScriptRoot '../..'), [ValidateRange(1024,65535)][int]$Port = 8765)
$ErrorActionPreference = 'Stop'
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw 'Python 3.10+ is required for the optional Git helper.' }
& python (Join-Path $PSScriptRoot 'server.py') --repo $RepoRoot --port $Port
exit $LASTEXITCODE
