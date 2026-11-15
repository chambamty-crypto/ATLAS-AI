$runDir = Join-Path $env:LOCALAPPDATA "ATLAS-AI\run"
foreach ($name in @("server-window.pid","cloudflared.pid")) {
  $file = Join-Path $runDir $name
  if (Test-Path $file) {
    $raw = (Get-Content $file -Raw).Trim()
    $pidValue = 0
    if ([int]::TryParse($raw,[ref]$pidValue)) { & taskkill.exe /PID $pidValue /T /F 2>$null | Out-Null }
    Remove-Item $file -Force -ErrorAction SilentlyContinue
  }
}
Write-Host "ATLAS-AI y la conexión temporal se han detenido." -ForegroundColor Green
