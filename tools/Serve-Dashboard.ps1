param([int]$Port = 8080)
Write-Host "Development History Dashboard"
Write-Host "Preferred: Python static server if available."
if (Get-Command python -ErrorAction SilentlyContinue) {
    Push-Location (Join-Path $PSScriptRoot "..\web")
    try { python -m http.server $Port }
    finally { Pop-Location }
    exit
}
Write-Error "Python not found. Implement an approved local static server or use an existing company-standard server. Do not silently install packages."
