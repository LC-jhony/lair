$ErrorActionPreference = "Continue"
$failures = 0

function Check([string]$Label, [scriptblock]$Body) {
  try {
    & $Body | Out-Null
    Write-Host "OK   $Label"
  } catch {
    Write-Host "FAIL $Label"
    $script:failures++
  }
}

$caddy = if (Get-Command caddy -ErrorAction SilentlyContinue) { "caddy" } else { ".\bin\caddy.exe" }
Check "caddy version >= 2.7" { & $caddy version | Select-String 'v2\.(7|8|9|[0-9]+)' }
Check "módulo reverse_proxy" { & $caddy list-modules | Select-String 'http.handlers.reverse_proxy' }
Check "módulo file_server" { & $caddy list-modules | Select-String 'http.handlers.file_server' }
Check "admin API :2019" { Invoke-WebRequest -Uri 'http://localhost:2019/config/' -Method Head }
Check "resolución *.test" { Resolve-DnsName foo.test }

if ($failures -gt 0) { throw "$failures comprobación(es) fallaron" }
Write-Host "Verificación del host correcta"
