param([switch]$Quick)
$ErrorActionPreference = 'Stop'
$dashboardRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $dashboardRoot
try {
    & python tools/build_dashboard.py --check
    if ($LASTEXITCODE -ne 0) { throw 'Bundled HTML is stale.' }
    & python tools/validate_public.py
    if ($LASTEXITCODE -ne 0) { throw 'Public artifact validation failed.' }
    if (-not $Quick) {
        & python -m unittest discover -s tests -p 'test_*.py' -v
        if ($LASTEXITCODE -ne 0) { throw 'Automated tests failed.' }
    }
    Write-Host 'Python checks passed. Open tests/browser.html on a test server for browser tests.'
} finally { Pop-Location }
