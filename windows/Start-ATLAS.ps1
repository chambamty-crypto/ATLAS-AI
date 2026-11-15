$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$Repo = "chambamty-crypto/ATLAS-AI"
$Branch = "feature/windows-one-click-server"
$Root = Join-Path $env:LOCALAPPDATA "ATLAS-AI"
$AppDir = Join-Path $Root "app"
$ToolsDir = Join-Path $Root "tools"
$RunDir = Join-Path $Root "run"
$LogDir = Join-Path $Root "logs"
New-Item -ItemType Directory -Force -Path $Root,$ToolsDir,$RunDir,$LogDir | Out-Null
function Say($Message, $Color = "White") { Write-Host $Message -ForegroundColor $Color }
function Set-EnvValue([string]$File, [string]$Name, [string]$Value) {
  $lines = @()
  if (Test-Path $File) { $lines = @(Get-Content -Path $File) }
  $pattern = '^\s*' + [regex]::Escape($Name) + '\s*='
  $found = $false
  for ($i=0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match $pattern) { $lines[$i] = "$Name=$Value"; $found = $true }
  }
  if (-not $found) { $lines += "$Name=$Value" }
  Set-Content -Path $File -Value $lines -Encoding utf8
}
Say ""
Say "ATLAS-AI | Instalador y servidor para Windows" Cyan
Say "Prepararé esta computadora para conectarse con tu celular." Gray
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
$nodeVersion = $null
if ($nodeCmd) { try { $nodeVersion = [version]((& node -p "process.versions.node").Trim()) } catch {} }
if (-not $nodeVersion -or $nodeVersion -lt [version]"22.13.0") {
  Say "Instalando Node.js..." Yellow
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) {
    Say "No encuentro winget. Instala Node.js LTS desde https://nodejs.org/ y vuelve a ejecutar este archivo." Red
    Read-Host "Presiona ENTER para salir"; exit 1
  }
  Start-Process -FilePath $winget.Source -ArgumentList @("install","--exact","--id","OpenJS.NodeJS","--accept-package-agreements","--accept-source-agreements","--silent") -Wait
  $nodePath = Join-Path $env:ProgramFiles "nodejs"
  if (Test-Path $nodePath) { $env:Path = "$nodePath;$env:Path" }
  $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
  if (-not $nodeCmd) {
    Say "Node.js se instaló, pero Windows todavía no lo detecta. Cierra esta ventana y vuelve a ejecutar el instalador." Red
    Read-Host "Presiona ENTER para salir"; exit 1
  }
}
$nodeVersion = [version]((& node -p "process.versions.node").Trim())
if ($nodeVersion -lt [version]"22.13.0") { throw "ATLAS-AI requiere Node.js 22.13 o posterior." }
Say "Node.js $nodeVersion detectado." Green
$archive = Join-Path $env:TEMP "atlas-ai-source.zip"
$extract = Join-Path $env:TEMP ("atlas-ai-source-" + [guid]::NewGuid().ToString("N"))
$archiveUrl = "https://github.com/$Repo/archive/refs/heads/$Branch.zip"
Say "Descargando ATLAS-AI..." Cyan
Invoke-WebRequest -Uri $archiveUrl -OutFile $archive
Expand-Archive -Path $archive -DestinationPath $extract -Force
$source = Get-ChildItem -Path $extract -Directory | Select-Object -First 1
if (-not $source -or -not (Test-Path (Join-Path $source.FullName "server.mjs"))) { throw "No se encontraron los archivos del servidor." }
New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
Copy-Item -Path (Join-Path $source.FullName "*") -Destination $AppDir -Recurse -Force
Remove-Item $extract -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $archive -Force -ErrorAction SilentlyContinue
$envFile = Join-Path $AppDir ".env"
if (-not (Test-Path $envFile)) { Copy-Item (Join-Path $AppDir ".env.example") $envFile }
Set-EnvValue $envFile "HOST" "127.0.0.1"
Set-EnvValue $envFile "PORT" "3000"
Set-EnvValue $envFile "NODE_ENV" "development"
Set-EnvValue $envFile "DEV_EMAIL_MODE" "console"
Set-EnvValue $envFile "ATLAS_DB_PATH" "./data/atlas.sqlite"
$currentEnv = Get-Content $envFile -Raw
if ($currentEnv -notmatch '(?m)^OPENAI_API_KEY=.+$') {
  Say ""
  Say "La clave de OpenAI es opcional para iniciar, pero necesaria para chat y voz." Yellow
  Say "El uso de la API puede generar cargos en tu cuenta." Yellow
  $secureKey = Read-Host "API key (ENTER para configurarla después)" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
  try { $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  if ($plainKey) { Set-EnvValue $envFile "OPENAI_API_KEY" $plainKey }
  $plainKey = $null
}
Say "Instalando componentes de ATLAS-AI..." Cyan
Push-Location $AppDir
try { & npm install --no-audit --no-fund; if ($LASTEXITCODE -ne 0) { throw "Falló npm install." } } finally { Pop-Location }
$cloudflared = Join-Path $ToolsDir "cloudflared.exe"
if (-not (Test-Path $cloudflared)) {
  Say "Descargando Cloudflare Tunnel..." Cyan
  Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $cloudflared
}
& $cloudflared --version | Out-Host
$portBusy = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($portBusy) { throw "El puerto 3000 ya está ocupado. Detén el servidor anterior de ATLAS-AI y vuelve a intentarlo." }
$cfOut = Join-Path $LogDir "cloudflared-out.log"
$cfErr = Join-Path $LogDir "cloudflared-error.log"
Remove-Item $cfOut,$cfErr -Force -ErrorAction SilentlyContinue
Say "Creando una dirección HTTPS temporal..." Cyan
$tunnel = Start-Process -FilePath $cloudflared -ArgumentList @("tunnel","--no-autoupdate","--url","http://127.0.0.1:3000") -PassThru -WindowStyle Hidden -RedirectStandardOutput $cfOut -RedirectStandardError $cfErr
$tunnelUrl = $null
for ($i=0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 1
  $logText = ""
  if (Test-Path $cfOut) { $logText += Get-Content $cfOut -Raw -ErrorAction SilentlyContinue }
  if (Test-Path $cfErr) { $logText += Get-Content $cfErr -Raw -ErrorAction SilentlyContinue }
  $match = [regex]::Match($logText, 'https://[a-z0-9-]+\.trycloudflare\.com')
  if ($match.Success) { $tunnelUrl = $match.Value; break }
  if ($tunnel.HasExited) { break }
}
if (-not $tunnelUrl) {
  if (-not $tunnel.HasExited) { Stop-Process -Id $tunnel.Id -Force -ErrorAction SilentlyContinue }
  throw "No pude obtener la dirección de Cloudflare. Revisa el archivo $cfErr."
}
Set-EnvValue $envFile "APP_URL" $tunnelUrl
Set-Content -Path (Join-Path $RunDir "cloudflared.pid") -Value $tunnel.Id -Encoding ascii
$serverCmd = 'cd /d "' + $AppDir + '" && npm start'
$server = Start-Process -FilePath $env:ComSpec -ArgumentList @("/k",$serverCmd) -PassThru
Set-Content -Path (Join-Path $RunDir "server-window.pid") -Value $server.Id -Encoding ascii
$healthy = $false
for ($i=0; $i -lt 40; $i++) {
  Start-Sleep -Seconds 1
  try { $health = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/health" -TimeoutSec 2; if ($health.ok) { $healthy = $true; break } } catch {}
}
if (-not $healthy) { throw "El servidor no respondió. Revisa la ventana de ATLAS-AI." }
Say ""
Say "ATLAS-AI ESTÁ EN LÍNEA" Green
Say "Dirección para tu celular:" Cyan
Say $tunnelUrl White
Say ""
Say "1. Abre la APK ATLAS-AI en Android y pega esa dirección."
Say "2. Si no tienes la APK, abre esa dirección en Chrome del celular."
Say "3. Registra tu correo. El enlace de verificación aparecerá en la ventana del servidor."
Say "4. Abre el enlace en la computadora y después inicia sesión desde el celular."
Say ""
Say "Mantén la computadora encendida y conectada a internet. No compartas la dirección ni uses información sensible."
Say "La dirección cambia cada vez que inicies el túnel. Para apagarlo ejecuta Detener-ATLAS.bat."
try { Set-Clipboard -Value $tunnelUrl; Say "Dirección copiada al portapapeles." Green } catch {}
Start-Process $tunnelUrl
Say ""
Say "Listo. Puedes dejar esta ventana abierta mientras usas ATLAS-AI." Gray
Read-Host "Presiona ENTER para cerrar este instalador (el servidor seguirá activo)"
