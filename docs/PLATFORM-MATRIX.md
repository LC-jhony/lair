# Matriz de plataforma

| SO | Caddy | DNS wildcard | CA | Servicio |
| --- | --- | --- | --- | --- |
| Linux (systemd) | `bin/caddy` | dnsmasq / systemd-resolved | `caddy trust` + `update-ca-certificates` | `systemctl enable --now caddy` |
| macOS 12+ | Homebrew o release oficial | `/etc/resolver/test` → `127.0.0.1` | `caddy trust` → Keychain | `brew services` / `launchctl` |
| Windows 11 | `caddy.exe` | sin wildcard en `hosts`: entradas por nombre | `caddy trust` → almacén Windows | `sc.exe create caddy ...` |

`macos-x64` no aparece en el catálogo publicado (HIPÓTESIS): verificar por
paquete antes de ofrecerlo en la UI. Windows 10 pre-19041 no soportado hasta
validación explícita.
