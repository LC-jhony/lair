param([string]$Version = "2.9.0")

$ErrorActionPreference = "Stop"
$archive = "caddy_${Version}_windows_amd64.zip"
$url = "https://github.com/caddyserver/caddy/releases/download/v${Version}/$archive"
$tmp = Join-Path $env:TEMP $archive

New-Item -ItemType Directory -Force -Path .\bin | Out-Null
Write-Host "Descargando $url"
Invoke-WebRequest -Uri $url -OutFile $tmp
Expand-Archive -Path $tmp -DestinationPath .\bin -Force
Remove-Item $tmp
Write-Host "Caddy instalado en .\bin\caddy.exe"
