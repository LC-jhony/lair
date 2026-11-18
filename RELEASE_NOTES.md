# Lair v1.0.0

Primera versión etiquetada de **Lair**: entorno de desarrollo local para **PHP / Laravel nativo**, sin Docker ni máquinas virtuales. Un único binario Go (biblioteca estándar, cero dependencias externas) contiene la CLI, el daemon y el punto de entrada de los shims. Todo se instala bajo una sola raíz (`$LAIR_HOME`, `$XDG_DATA_HOME/lair` o `~/.local/share/lair`) y los servicios corren como el usuario, escuchando solo en `127.0.0.1`.

---

## Campos del release

Esta versión publica **un asset por plataforma y arquitectura**: Linux, macOS y Windows, cada uno en `amd64` y `arm64`. Los seis comprimidos contienen `lair` (o `lair.exe`), `README.md` y `RELEASE_NOTES.md`; además, Linux incluye **dos paquetes `.deb`** (`amd64` y `arm64`) para instalar con `dpkg`/`apt`. Los binarios se compilaron con `CGO_ENABLED=0`, `-trimpath` y `-ldflags "-s -w"` (estáticos, sin dependencias externas).

### Campos generales

| Campo | Valor | Descripción |
| --- | --- | --- |
| `tag` | `v1.0.0` | Etiqueta **anotada** de Git. Identifica esta versión de forma inmutable; no se reutiliza. |
| `target` | `main` | Commit etiquetado (la rama `main` en el momento del release); se comprueba con `git rev-parse v1.0.0^{commit}`. Incluye el commit inicial de GitHub integrado con la historia de Lair. |
| `title` | `Lair v1.0.0` | Título que se muestra en la página del release. |
| `body` | Este `RELEASE_NOTES.md` | Descripción publicada: novedades, campos de cada asset, instalación, verificación y seguridad. |
| `draft` | `false` | El release se publica de inmediato, no queda como borrador. |
| `prerelease` | `false` | Versión estable; no se marca como beta ni *release candidate*. |
| `assets` | 9 archivos | Seis comprimidos (dos por plataforma), dos `.deb` de Linux (`amd64` y `arm64`) y `SHA256SUMS` con los hashes oficiales. |
| `repository` | `LC-jhony/lair` | Repositorio de GitHub donde se crea el release. |

### Campos de cada asset (comunes a las tres plataformas)

| Campo | Descripción |
| --- | --- |
| `Asset` | Nombre del archivo adjunto al release; es lo que descarga el usuario. |
| `Sistema operativo` | Plataforma de destino: Linux, macOS o Windows. |
| `Arquitectura` | `amd64` (x86_64, Intel/AMD de 64 bits) o `arm64` (AArch64, Apple Silicon / ARM de 64 bits). |
| `Formato` | `.tar.gz` en Linux y macOS; `.zip` en Windows; además `.deb` en Linux. |
| `Binario` | `lair` en Linux y macOS; `lair.exe` en Windows. |
| `Tamaño` | Bytes del asset comprimido y su equivalente en MiB. |
| `SHA-256` | Hash del **archivo publicado**. Es la fuente de confianza: el host de descarga no aporta confianza. |
| `Verificación` | Comando que compara el hash local con `SHA256SUMS` antes de ejecutar nada. |
| `Instalación` | Pasos mínimos: descargar, descomprimir, instalar el binario en el PATH y ejecutar `lair install`. |
| `Notas` | Particularidades de la plataforma (Gatekeeper, PowerShell, plan privilegiado). |

---

### Linux

| Campo | amd64 (x86_64) | arm64 (AArch64) | Descripción |
| --- | --- | --- | --- |
| `Asset` | `lair_1.0.0_linux_amd64.tar.gz` | `lair_1.0.0_linux_arm64.tar.gz` | Archivo adjunto al release para esta arquitectura. |
| `Sistema operativo` | Linux | Linux | Binario estático: no requiere glibc ni dependencias del sistema. |
| `Arquitectura` | `amd64` | `arm64` | x86_64 (Intel/AMD) frente a AArch64 (ARM de 64 bits). |
| `Formato` | `.tar.gz` | `.tar.gz` | Se extrae con `tar -xzf`. |
| `Binario` | `lair` | `lair` | Ejecutable instalado en `$HOME/.local/bin/lair`. |
| `Tamaño` | 3 717 359 bytes (3.54 MiB) | 3 338 438 bytes (3.18 MiB) | Tamaño del comprimido publicado. |
| `SHA-256` | `83a01faa19f121d19701c6a73ef0f12c8ac1ff37bcf4c58368428bc0ea4551c8` | `ed97236d32fb491381185dbe009659460d94b8d89ed6e8e1c1473b87a70b4bd0` | Hash oficial; comparar con `dist/SHA256SUMS`. |
| `Asset (.deb)` | `lair_1.0.0_amd64.deb` | `lair_1.0.0_arm64.deb` | Paquete Debian para instalar con `sudo dpkg -i`. |
| `Sistema operativo (.deb)` | Debian/Ubuntu y derivados | Debian/Ubuntu y derivados en ARM | El binario es estático; el paquete solo instala archivos. |
| `Arquitectura (.deb)` | `amd64` | `arm64` | Debe coincidir con `dpkg --print-architecture`. |
| `Formato (.deb)` | `.deb` | `.deb` | Paquete Debian 2.0 con `root:root` y `usr/bin/lair`. |
| `Tamaño (.deb)` | 3 151 864 bytes (3.01 MiB) | 2 803 526 bytes (2.67 MiB) | Tamaño del paquete publicado. |
| `SHA-256 (.deb)` | `d8b46432f01126e199aa618000e7056e5a3bbd93430b76091362671a6bc87e44` | `599720fa7b2cf830012c78ecd1b672d0d16afe4aa8de57a5ef3224f39695611b` | Hash oficial del `.deb`; comparar con `SHA256SUMS`. |
| `Verificación` | `sha256sum -c SHA256SUMS` | `sha256sum -c SHA256SUMS` | Valida los ocho assets de una sola vez. |
| `Instalación` | Ver bloques **Instalación en Linux** e **Instalación con .deb**. | Igual que amd64, cambiando el nombre del asset. | Comprimido en `$HOME/.local/bin` o paquete en `/usr/bin/lair`. |
| `Notas` | Plan privilegiado disponible: systemd, polkit, `systemd-resolved` y CA del sistema. | Igual que amd64; usar este asset en equipos ARM (Raspberry Pi, servidores ARM). | Linux es la única plataforma con `setup-privileged.sh`. |

**Instalación en Linux**

```sh
# 1. Descargar el asset correcto (amd64); para arm64 cambia el nombre del archivo
curl -fLO https://github.com/LC-jhony/lair/releases/download/v1.0.0/lair_1.0.0_linux_amd64.tar.gz
curl -fLO https://github.com/LC-jhony/lair/releases/download/v1.0.0/SHA256SUMS

# 2. Verificar la descarga antes de ejecutar
sha256sum -c SHA256SUMS

# 3. Extraer e instalar en el PATH del usuario
tar -xzf lair_1.0.0_linux_amd64.tar.gz
mkdir -p "$HOME/.local/bin"
install -m 0755 lair "$HOME/.local/bin/lair"
export PATH="$HOME/.local/bin:$PATH"

# 4. Arrancar Lair y aplicar el plan privilegiado (revisarlo antes de ejecutar)
"$HOME/.local/bin/lair" install
sudo "$HOME/.local/share/lair/setup-privileged.sh"
sudo "$HOME/.local/share/lair/trust-ca.sh" --add
sudo systemctl enable --now "lair@$USER"
```

Tras abrir una terminal nueva: `lair php install 8.4 && lair php use 8.4`, `lair node install 22 && lair node default 22` y `lair doctor`.

**Instalación con .deb en Linux (alternativa)**

```sh
# 1. Descargar el paquete de tu arquitectura y el SHA256SUMS
curl -fLO https://github.com/LC-jhony/lair/releases/download/v1.0.0/lair_1.0.0_amd64.deb
curl -fLO https://github.com/LC-jhony/lair/releases/download/v1.0.0/SHA256SUMS

# 2. Verificar antes de instalar
sha256sum -c SHA256SUMS

# 3. Instalar el paquete (instala /usr/bin/lair, docs y copyright)
sudo dpkg -i lair_1.0.0_amd64.deb

# 4. Arrancar Lair y aplicar el plan privilegiado (revisarlo antes)
lair install
sudo "$HOME/.local/share/lair/setup-privileged.sh"
sudo "$HOME/.local/share/lair/trust-ca.sh" --add
sudo systemctl enable --now "lair@$USER"
```

En ARM cambia `amd64` por `arm64`. Comprueba tu arquitectura con `dpkg --print-architecture`. El `.deb` instala el binario en `/usr/bin/lair` (disponible para todos los usuarios); Lair guarda sus datos igualmente bajo `$LAIR_HOME` del usuario que lo ejecuta. Para desinstalar el paquete: `sudo dpkg -r lair`; recuerda ejecutar antes `lair uninstall` para limpiar el estado del usuario.

---

### macOS

| Campo | Apple Silicon (arm64) | Intel (amd64) | Descripción |
| --- | --- | --- | --- |
| `Asset` | `lair_1.0.0_darwin_arm64.tar.gz` | `lair_1.0.0_darwin_amd64.tar.gz` | Archivo adjunto al release para esta arquitectura. |
| `Sistema operativo` | macOS | macOS | Binario estático para macOS; sin Homebrew ni dependencias externas. |
| `Arquitectura` | `arm64` (Apple Silicon) | `amd64` (x86_64, Intel) | Elegir según el chip: M1/M2/M3/M4 → arm64; Intel → amd64. |
| `Formato` | `.tar.gz` | `.tar.gz` | Se extrae con `tar -xzf`. |
| `Binario` | `lair` | `lair` | Ejecutable instalado en `$HOME/.local/bin/lair`. |
| `Tamaño` | 3 452 974 bytes (3.29 MiB) | 3 765 857 bytes (3.59 MiB) | Tamaño del comprimido publicado. |
| `SHA-256` | `e7a7cbd1420ab5dfcfcef10925e15efa639701b1f02d364454d145e086a1595e` | `90f22927f29bcbce186735729327f8586303daf6fbd6c1ee9b6da728b711895f` | Hash oficial; comparar con `dist/SHA256SUMS`. |
| `Verificación` | `shasum -a 256 -c SHA256SUMS` | `shasum -a 256 -c SHA256SUMS` | Valida los seis assets de una sola vez. |
| `Instalación` | Ver bloque **Instalación en macOS**. | Igual que arm64, cambiando el nombre del asset. | Descargar, verificar, extraer, instalar en `$HOME/.local/bin` y ejecutar `lair install`. |
| `Notas` | Asset por defecto en Macs con Apple Silicon. | Asset para Macs Intel. Si Gatekeeper bloquea el binario: `xattr -d com.apple.quarantine "$HOME/.local/bin/lair"`. | No se genera plan privilegiado; la CA se confía solo en el perfil de usuario. |

**Instalación en macOS**

```sh
# 1. Descargar el asset correcto (Apple Silicon); para Intel usa darwin_amd64
curl -fLO https://github.com/LC-jhony/lair/releases/download/v1.0.0/lair_1.0.0_darwin_arm64.tar.gz
curl -fLO https://github.com/LC-jhony/lair/releases/download/v1.0.0/SHA256SUMS

# 2. Verificar la descarga antes de ejecutar
shasum -a 256 -c SHA256SUMS

# 3. Extraer e instalar en el PATH del usuario
tar -xzf lair_1.0.0_darwin_arm64.tar.gz
mkdir -p "$HOME/.local/bin"
install -m 0755 lair "$HOME/.local/bin/lair"
export PATH="$HOME/.local/bin:$PATH"

# 4. Arrancar Lair y comprobar el entorno
"$HOME/.local/bin/lair" install
"$HOME/.local/bin/lair" doctor
```

Para hacer persistente el PATH, añade `export PATH="$HOME/.local/bin:$PATH"` a `~/.zshrc` (o `~/.bash_profile`). Si Gatekeeper bloquea el binario descargado: `xattr -d com.apple.quarantine "$HOME/.local/bin/lair"`.

---

### Windows

| Campo | amd64 (x86_64) | arm64 | Descripción |
| --- | --- | --- | --- |
| `Asset` | `lair_1.0.0_windows_amd64.zip` | `lair_1.0.0_windows_arm64.zip` | Archivo adjunto al release para esta arquitectura. |
| `Sistema operativo` | Windows 10/11 | Windows 10/11 ARM | Binario estático `lair.exe`; sin dependencias externas. |
| `Arquitectura` | `amd64` (x86_64) | `arm64` (AArch64) | Elegir según el procesador: la mayoría de PCs → amd64; Surface/ARM → arm64. |
| `Formato` | `.zip` | `.zip` | Se extrae con `Expand-Archive`. |
| `Binario` | `lair.exe` | `lair.exe` | Ejecutable instalado en `%LOCALAPPDATA%\Lair\lair.exe`. |
| `Tamaño` | 3 804 437 bytes (3.62 MiB) | 3 384 610 bytes (3.22 MiB) | Tamaño del comprimido publicado. |
| `SHA-256` | `692f4dc6d4b035ec1be181545f7dd03c3e434c80bc634cebfe92c0a8052c3fe2` | `bbec4df4dae8e5755a872f82ca0215b279faf0bf02cc46a09ba9463ddeaf0bbf` | Hash oficial; comparar con `dist/SHA256SUMS`. |
| `Verificación` | `Get-FileHash lair.zip -Algorithm SHA256` | `Get-FileHash lair.zip -Algorithm SHA256` | Comparar el valor con la línea correspondiente de `SHA256SUMS`. |
| `Instalación` | Ver bloque **Instalación en Windows (PowerShell)**. | Igual que amd64, cambiando el nombre del asset. | Descargar, verificar, `Expand-Archive` en `%LOCALAPPDATA%\Lair` y ejecutar `lair.exe install`. |
| `Notas` | Asset por defecto en PCs Windows. | Asset para Windows en ARM. | No se genera plan privilegiado; la CA se confía solo en el perfil de usuario. |

**Instalación en Windows (PowerShell)**

```powershell
# 1. Descargar el asset correcto (amd64); para ARM usa windows_arm64
Invoke-WebRequest -Uri "https://github.com/LC-jhony/lair/releases/download/v1.0.0/lair_1.0.0_windows_amd64.zip" -OutFile lair.zip
Invoke-WebRequest -Uri "https://github.com/LC-jhony/lair/releases/download/v1.0.0/SHA256SUMS" -OutFile SHA256SUMS

# 2. Verificar la descarga antes de ejecutar
Get-FileHash lair.zip -Algorithm SHA256
Get-Content SHA256SUMS

# 3. Extraer y añadir al PATH de la sesión
Expand-Archive lair.zip -DestinationPath "$env:LOCALAPPDATA\Lair" -Force
$env:Path = "$env:LOCALAPPDATA\Lair;$env:Path"

# 4. Arrancar Lair y comprobar el entorno
& "$env:LOCALAPPDATA\Lair\lair.exe" install
& "$env:LOCALAPPDATA\Lair\lair.exe" doctor
```

Para hacer persistente el PATH:

```powershell
[Environment]::SetEnvironmentVariable("Path", "$env:LOCALAPPDATA\Lair;$([Environment]::GetEnvironmentVariable('Path','User'))", "User")
```

> **Plan privilegiado:** systemd, polkit, `systemd-resolved` y la CA a nivel de sistema están implementados solo en Linux. En macOS y Windows funcionan la CLI, el daemon, el DNS en puertos altos, HTTPS con CA de usuario y los shims, pero no se genera ese plan; la CA puede confiarse solo en el perfil de usuario.

---

## Novedades por fases

### Fase 1 — Catálogo firmado e instalación atómica

- Catálogo JSON con `schema`, `channel`, `serial`, `generated`, `expires` y paquetes por plataforma.
- Firma **Ed25519** en `.sig` base64; clave pública embebida con `go:embed`. Se rechazan firma inválida, canal distinto, schema desconocido, manifiesto expirado y serial menor.
- Múltiples URLs base de mirrors (`LAIR_MANIFEST_BASE_URLS`) con fallback en orden: la confianza depende de la firma, no del host.
- Caché del manifiesto con refresco en segundo plano tras 6 h y hook `OnChange` para reaccionar a cambios del catálogo.
- Descarga a `.part`, verificación **SHA-256 en streaming**, extracción con `safeJoin` (impide `../`), `Prepare` + `os.Rename` atómicos y marcador de build.
- `installer.Manager` con un job por paquete: fases, progreso, cancelación, logs en `log/<id>-install.log` y hooks `OnSuccess`.
- Builds marcados como *yanked* se rechazan y se reemplazan automáticamente (`Engine.ReplaceYanked`) al detectar una corrección vía `OnChange`.

### Fase 2 — PHP, Composer, Node y shims

- PHP **8.1–8.5 en paralelo** bajo `php/<minor>/`; `php.ini` se crea una vez y se preserva en actualizaciones.
- PHP-FPM por socket unix en `run/`, pool de depuración Xdebug separado y detección de extensiones requeridas desde `composer.json` / `.env`.
- `composer.phar` descargado solo si su SHA-256 coincide con el publicado; se ejecuta con el intérprete PHP correcto. URLs sustituibles por `LAIR_COMPOSER_DOWNLOAD_URL` / `LAIR_COMPOSER_CHECKSUM_URL`.
- Node con builds oficiales y resolución por proyecto: aislado → `.lairrc` (antes `.flockrc`) → `.nvmrc` / `.node-version` → default → más reciente. Alias ambiguos (`lts/*`, `node`, `stable`) se ignoran.
- Prefijo global de npm por major (`node/global/<major>/`) para que los paquetes globales sobrevivan a actualizaciones patch.
- Shims en `bin/` para `php`, `php-fpm`, `composer`, `node`, `npm`, `npx` y clientes de servicios. `lair exec` (oculto) usa `execve`, sin proceso intermediario.
- Perfiles bash, zsh, fish y `environment.d` idempotentes y reversibles, delimitados por `# >>> lair >>>` / `# <<< lair <<<`.

### Fase 3 — Servicios, supervisor y plataforma

- Specs puros para PostgreSQL 14–18, MySQL, MariaDB, MongoDB, Valkey/Redis, Meilisearch, Typesense y RustFS, con argumentos, entorno, init de datos, clientes y snippet para `.env`.
- Una sola versión activa por puerto; detección de conflictos con sugerencia de puerto alternativo. Validación adicional en MySQL/MariaDB para impedir que un config externo cambie bind, puerto o socket.
- Datos separados por “línea” (`services/<id>/data/<línea>/`; PostgreSQL usa el major) y conservados al cambiar de versión salvo `--delete-data`.
- Supervisor con backoff exponencial (1 s → 60 s), estado por servicio, cola de logs y señales al grupo de procesos. Sin deadlock al registrar logs.
- Plan privilegiado revisable: unidad `lair@<usuario>.service` (`User=%i`, `CAP_NET_BIND_SERVICE`, `NoNewPrivileges=yes`), regla polkit, drop-in de `systemd-resolved` (`DNS=127.0.0.1#53535`, `Domains=~test`) y helpers de CA con `--add` / `--remove`.
- Reversión completa con `revert-privileged.sh`; los scripts se conservan en `$HOME` si se usa `--delete-data`.

### Fase 4 — Daemon, DNS, HTTPS y CLI

- API local en unix socket con token de 256 bits (`0600`, comparación en tiempo constante). `internal/daemon/protocol.go` es la fuente única de acciones y payloads.
- DNS UDP propio en `127.0.0.1:53535`: responde `*.test` y reenvía el resto al upstream de `/etc/resolv.conf`.
- CA ECDSA P-256 local, certificados por sitio con SAN wildcard y soporte de confianza en sistema y navegadores.
- Capa web propia con `net/http`, TLS dinámico, router por Host, archivos estáticos en `public/` y cliente FastCGI mínimo hacia PHP-FPM (sin binario proxy externo).
- `Engine` concentra la lógica compartida: instalación, sitios, exec, bootstrap, reemplazo de yanked y supervisión. Daemon y CLI son dos frentes del mismo motor; modo offline disponible.
- CLI completa: `install`, `uninstall`, `status`, `restart`, `update`, `php`, `node`, `services`, `park`, `link`, `unlink`, `secure`, `pin`, `isolate`, `logs`, `daemon`, `doctor` y `exec` oculto.
- Flags del daemon: `--foreground`, `--no-web`, `--no-dns`, `--no-api`, `--dns-port`, `--http-port`, `--https-port` y `--domain`.

---

## Correcciones incluidas

- **`node -v` / `npm -v` no reconocidos:** `Bootstrap` ahora crea shims y PATH **antes** de descargar Composer. Composer y la CA son *best-effort* (avisos, no abortan), con timeout de 45 s. Cualquier `lair ... install` regenera shims y PATH al terminar.
- **Nuevo `lair doctor`:** diagnostica PATH, shims faltantes y versiones instaladas; imprime el `export PATH=...` exacto para la terminal actual.
- **`lair uninstall`:** `revert-privileged.sh` ya no reinstala la CA; invoca `<LAIR_HOME>/trust-ca.sh --remove` y `trust-ca-user.sh --remove`, con reversión NSS incluida.
- **Desinstalación completa:** `lair uninstall` ahora elimina PHP, `composer.phar`, Node, los binarios de todos los servicios (incluido MariaDB), shims, PATH, certificados, logs, caché y `config.json`; conserva las bases de datos salvo `--delete-data` y mantiene los scripts de reversión. Lair no instala nginx, Laravel Valet ni Mailcatcher, así que no se eliminan paquetes del sistema; solo se limpian directorios legacy con esos nombres dentro de `$LAIR_HOME`.
- **Nombre del proyecto:** se consolidó `lair` en módulo Go (`github.com/lair-sh/lair`), binario, rutas, documentación y mensajes. Los restos del nombre anterior se renombraron a `.lairrc` y `lair.json`, manteniendo **compatibilidad**: `.flockrc` y `flock.json` siguen leyéndose, `.lairrc` tiene prioridad y el primer `lair pin` migra el contenido sin borrar el archivo antiguo.
- Referencias al antiguo diseño “Caddy embebido” actualizadas a “capa web embebida”.

---

## Documentación

- `README.md` reenfocado en **compilación/Makefile, configuración y uso del comando `lair`**: quick start, los 7 targets del Makefile, cross-compilación, precedencia de `LAIR_HOME`, `config.json`, `.lairrc`, variables de entorno, perfiles, scripts privilegiados, referencia de comandos y flujos prácticos (Laravel nuevo, dos proyectos con PHP distinto, cambio de BD, instalación sin red), además de un mapa de módulos y troubleshooting.
- `docs/CLI.md`, `docs/ARCHITECTURE.md`, `docs/PHASES.md` y `docs/SECURITY.md` actualizados con `doctor`, las nuevas variables y el renombrado compatible.

---

## Verificación

- `gofmt -l .`: sin salida.
- `go vet ./...`: sin hallazgos.
- `go test ./...`: todos los paquetes en `ok`, incluidos los tests de regresión de shims, bootstrap resiliente, doctor, reversiones de uninstall, dispatcher, yanked y compatibilidad `.flockrc` / `flock.json`.
- `go build ./...` y `go build -o lair ./cmd/lair`: correctos.
- Smoke tests: `lair status` offline, daemon en foreground, `node -v` → `v22.11.0` y `npm -v` → `10.9.0` a través del shim con PATH configurado, e `install` con red bloqueada creando los 17 shims y avisando de Composer.

> `go test -race` requiere `gcc`/cgo y no estaba disponible en el entorno de compilación; no bloquea esta versión.

---

## Seguridad

- La clave `keys/private.ed25519` es **solo de desarrollo** y no se versiona ni se embebe; se excluye mediante `.gitignore`.
- `certs/ca-key.pem` permite emitir certificados válidos en todo el sistema si la CA está instalada: trátala como secreto.
- Los scripts privilegiados no se ejecutan automáticamente: el usuario los revisa y los lanza con `sudo`.
- No hay sandbox: los servicios son procesos normales del usuario. El DNS propio es UDP mínimo sin DNSSEC.

---

## Instalación rápida

```sh
export PATH="$HOME/.local/go/bin:$PATH"
cd lair && make build
./lair install
sudo "$LAIR_HOME/setup-privileged.sh"
sudo "$LAIR_HOME/trust-ca.sh" --add
sudo systemctl enable --now lair@$USER
# abre una terminal nueva
lair php install 8.4 && lair php use 8.4
lair node install 22 && lair node default 22
node -v && npm -v && php -v && lair doctor
```

---

## Publicación del release

Lair se publica en el repositorio **`LC-jhony/lair`** (antes `valet-deck`, renombrado conservando el historial). La rama `main`, el tag anotado `v1.0.0`, estos campos y estos assets están preparados localmente en `/home/jhony/Documentos/lair`.

La publicación requiere credenciales de GitHub (un PAT con permiso `repo` o `gh auth login`). Hay dos formas:

**Opción A — script preparado (recomendado):**

```sh
cd /home/jhony/Documentos/lair
./scripts/create-release.sh
```

El script valida la autenticación, comprueba que el tag apunte a `HEAD`, sube `main` y el tag, y crea el release con el título, el cuerpo y los nueve assets descritos arriba. Si el release ya existe, primero elimina los assets antiguos con el mismo nombre y vuelve a subirlos (necesario tras regenerar `SHA256SUMS`).

**Opción B — comandos manuales:**

```sh
cd /home/jhony/Documentos/lair
git push origin main
git push origin v1.0.0
gh release create v1.0.0 \
  --repo LC-jhony/lair \
  --title "Lair v1.0.0" \
  --notes-file RELEASE_NOTES.md \
  --verify-tag \
  dist/SHA256SUMS \
  dist/lair_1.0.0_amd64.deb \
  dist/lair_1.0.0_arm64.deb \
  dist/lair_1.0.0_darwin_amd64.tar.gz \
  dist/lair_1.0.0_darwin_arm64.tar.gz \
  dist/lair_1.0.0_linux_amd64.tar.gz \
  dist/lair_1.0.0_linux_arm64.tar.gz \
  dist/lair_1.0.0_windows_amd64.zip \
  dist/lair_1.0.0_windows_arm64.zip
```

> `draft` y `prerelease` se omiten porque `gh` los deja en `false` por defecto, tal como indica la tabla de campos generales.
