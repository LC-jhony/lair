# Arquitectura

```
Renderer (React 19) --window.flock.invoke--> preload --flock:invoke--> Electron main
    -> Backend.invoke(cmd, argsJson) [napi-rs] -> crypto / manifest / binaries / caddy / db / sites
                                                        -> SQLite, filesystem, Caddy Admin :2019
```

- **Contrato único:** `window.flock.invoke(cmd, args)` y `window.flock.onEvent(cb)`.
- **Rust in-process:** un `Backend` con `invoke` que devuelve un envelope JSON
  `{ ok: true, data }` o `{ ok: false, error: { code, message } }`.
- **Persistencia:** SQLite WAL en `~/.local/share/flock/flock.sqlite3` (tablas
  `sites`, `installed_binaries`, `site_pins`, `app_state`).
- **Manifiesto:** descargado y verificado con Ed25519 antes de uso; caché en
  `~/.local/share/flock/cache/binaries/`.
- **Caddy:** configuración via Admin API (`/adapt`, `/validate`, `/load`);
  backups `Caddyfile.<timestamp>` en `~/.local/share/flock/config/`.
- **Sin addon nativo:** Electron usa un estado local en `userData/flock-state.json`
  para que la UI siga siendo funcional durante el desarrollo.

Ver `README.md` §7 para la tabla de comandos y §24 para la política
Observado / Inferido / HIPÓTESIS.
