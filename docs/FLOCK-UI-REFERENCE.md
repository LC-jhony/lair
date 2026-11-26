# Referencia de interfaz de Flock — para duplicar en Lair

> Documento de **revisión de diseño**, no de implementación. Generado con REA sobre el artefacto
> instalado, contrastado con el código fuente y las capturas oficiales de `flock-main.zip`.
> Sirve como especificación visual y de arquitectura de UI para replicar la experiencia en Lair
> (Electron + React 19 + Tailwind v4 + shadcn/ui).

---

## 0. Método, alcance y evidencia

### 0.1 Objetivos y preguntas respondidas

| # | Pregunta | Estado |
|---|----------|--------|
| Q1 | ¿Qué tecnología usa la UI original? | Respondida (REA + fuente) |
| Q2 | ¿Cuáles son las superficies y su jerarquía? | Respondida (fuente + capturas) |
| Q3 | ¿Cómo es el panel "at a glance" y su menú? | Respondida (captura + `tray.rs`) |
| Q4 | ¿Cómo es la ventana principal y sus panes? | Respondida (`window.rs`, captura) |
| Q5 | ¿Cómo son las ventanas Mail / Dumps? | Respondida (capturas + fuente) |
| Q6 | ¿Qué tokens visuales y patrones de componentes usa? | Respondida (`common.rs`, capturas) |
| Q7 | ¿Qué hay ya en Lair y qué falta? | Respondida (inspección de `src/`) |

### 0.2 Artefactos analizados con REA

| Artefacto | Uso | SHA-256 / evidencia |
|-----------|-----|---------------------|
| `/usr/libexec/flockphp/flock-app` (ELF x86-64, 7 980 656 B) | App de escritorio Linux (GTK 4 + libadwaita) | `a64408789e6c9aad2033706932114a8a017e8b9c9ee2e439d57a9ea8299fcb08` |
| `/usr/libexec/flockphp/flock` (ELF x86-64, 61 821 088 B) | CLI/daemon Go | Evidencia REA `ev_bf4fae9376e51f5de1358d0fe3f4cc14e0e161142ebe19cd0f6885f933f953c3` |

Resultados REA relevantes:

- **App**: `inspect_rust_binary` → binario Rust strippeado, `amd64`, un hash de commit de rustc
  inferido de una ruta `/rustc/<40-hex>/`. **Sin metadatos cargo-auditable**: la ausencia de
  `.dep-v0` **no** prueba que no haya dependencias. Evidencia: `ev_40ddba796b0bac48c731564561ca2daf2f8a7891a6b652b04ed99ef9d9831787`,
  padre `ev_f63ee7c994bdcdfab7fff0ac9756fae831b222ef45c060898307f7ddb7cd0ea8`.
- **CLI**: `inspect_go_binary` → `go1.27.2`, módulo `flock/cmd/flock`, versión `v1.1.1`,
  168 dependencias, metadatos `complete: true`. Evidencia padre
  `ev_95f67b0b5a39f6f267cbfa20e526c0b171a5d2e3b9ab1daf6f3bd021a6e44dcb`.
- **Sesión REA**: no hay proveedor nativo disponible (Ghidra/Hopper/IDA/Kuna deshabilitados),
  por lo que no se descompilaron funciones; el análisis se limita a inspección *target-free*
  y a las cadenas i18n incrustadas observadas en el binario.
- **Limitaciones**: los metadatos incrustados son contenido del archivo, **no autentican**
  proveniencia ni comportamiento en runtime. Las capturas muestran la variante **macOS**;
  la variante Linux comparte la estructura (confirmado en `window.rs`: «a sidebar of panes like
  the macOS app's Settings window has them») pero usa widgets libadwaita.

### 0.3 Fuentes complementarias

- `flock-main.zip` → `linux/src/**` (UI real), `lang/en/app.json` (**1 258 claves**, 21 grupos),
  `.github/art/*.png` (capturas claro/oscuro).
- **`Observado`** = captura, código fuente o evidencia REA. **`Inferido`** = valor de estilo
  deducido de la imagen. Ningún valor inferido debe copiarse como verdad absoluta.

---

## 1. Arquitectura de información (4 superficies)

```
                    ┌──────────────────────────────┐
                    │ Barra de menú / bandeja      │  ← "at a glance" (panel)
                    │ icono de pájaro + menú       │
                    └──────────────┬───────────────┘
                                   │ clic / "Open Flock", "Settings…"
       ┌───────────────────────────┼───────────────────────────┐
       ▼                           ▼                           ▼
┌─────────────┐          ┌────────────────────┐      ┌──────────────────┐
│ Setup       │  si no   │ Settings (10 panes)│      │ Mail / Dumps /   │
│ (wizard)    │  instalado  sidebar + detalle │      │ Logs (ventanas)  │
└─────────────┘          └────────────────────┘      └──────────────────┘
```

Tres apps nativas con **paridad de funciones**, todas hablando con el daemon por API local con token:

| Plataforma | Toolkit | Fuente |
|-----------|---------|--------|
| macOS | SwiftUI / SwiftPM (`FlockBar`, `FlockUI`, `FlockKit`) | `macos/` |
| Windows | WinUI 3 (`Flock.Kit`, `Flock.Tray`) + Inno Setup | `windows/` |
| Linux | **Rust + GTK 4 + libadwaita + WebKitGTK 6** | `linux/src/` |

Textos compartidos: `lang/<código>/app.json` (clave → texto, notas y plurales); `en`, `es`, `cs`.

**Implicación para Lair:** no se trata de copiar código (AGPL-3.0), sino de replicar la
**arquitectura de información, los estados, los patrones y el lenguaje visual** con componentes
propios de React/shadcn.

---

## 2. Panel de bandeja / barra de menú

### 2.1 Composición visual — `panel-running-light.png` (Observado)

```
┌─────────────────────────────────────┐
│  [pájaro]  Flock                    │  cabecera: icono 32px + título 17px semibold
│            Running · v1.0.0         │  subtitle "Running · {version}" / "Needs attention · {version}"
├─────────────────────────────────────┤
│ SERVICES                            │  cabecera de sección: 11px, uppercase, tracking +, gris
│ ● Web                 http :80 ·…   │  punto verde + etiqueta a la izq.; detallemono a la der.
│ ● DNS                 *.test        │
│ ● Mail                smtp 127…2525 │
│ ● PostgreSQL    18.6 on 127…:5432   │
│ ● Valkey        9.1.2 on 127…:6379  │
│ ● MySQL         8.4.11 on …:3306    │
│ ● php8.5-fpm                    up  │
│ ● php8.4-fpm                    up  │
├─────────────────────────────────────┤
│ SITES                               │
│ 🔒 acme.test              PHP 8.5   │  candado = HTTPS, globo = HTTP
│ 🌐 blog.test              PHP 8.4   │
│ 🔒 shop.test              PHP 8.5   │
├─────────────────────────────────────┤
│ 🐛 Xdebug              [toggle ON]  │  interruptor azul, inclinado hacia la derecha
│ 📥 Capture dumps & queries [toggle] │
├─────────────────────────────────────┤
│ ┌────────┐ ┌────────┐ ┌────────┐   │  3 botones tarjeta, icono arriba + etiqueta + badge
│ │ ✉ Mail │ │ 🐛Dump│ │ 📄Logs │   │  badge azul claro con el contador cuando > 0
│ │   ③    │ │   ③    │ │        │   │
│ └────────┘ └────────┘ └────────┘   │
├─────────────────────────────────────┤
│ Restart  Settings…      Quit Flock │  enlaces de texto al pie
└─────────────────────────────────────┘
```

Ancho Observado ≈ 360 px; fondo gris claro; separadores de 1 px entre secciones.

### 2.2 Menú de la bandeja (`linux/src/tray.rs`, Observado)

Orden exacto del menú (idéntico en intención a Windows/macOS):

1. Estado: `headline` (deshabilitado, no clicable) + primera advertencia
2. Separador
3. Si hace falta setup → `Set Up Flock…`; si no → `Open Flock` + separador
4. `Sites` (submenú): sitios no-worktree con sus worktrees como submenú (`acme.test (2)`),
   luego separador, proxies (`blog.test · Not running`), `No sites yet` si vacío, separador,
   `Manage Sites…`
5. `Mail (n)` / `Dumps (n)` / `Logs` (el contador solo aparece si > 0)
6. Separador
7. Toggles con checkmark: **Xdebug**, **Capture dumps**
8. Separador
9. `Settings…`, `Restart Flock` (o `Start Flock`)
10. `Quit Flock`

El icono cambia: `dev.flock.Flock-symbolic` (normal), `-warning-symbolic` (degradado),
`-stopped-symbolic` (parado). El tooltip es `Flock — {headline}` + advertencia; en GNOME no se
muestra, por eso el menú repite el estado arriba.

---

## 3. Ventana principal / Settings

### 3.1 Estructura (`linux/src/window.rs`, Observado)

- `adw::ApplicationWindow` **900 × 640** por defecto.
- `adw::NavigationSplitView`: sidebar + contenido. **Breakpoint a 560 sp** → modo colapsado
  (sidebar y pane se turnan; clic en la fila seleccionada vuelve al contenido).
- Sidebar: `gtk::ListBox` con clase `navigation-sidebar`, filas con `icono + etiqueta`,
  spacing 12, márgenes 6.
- HeaderBar de la sidebar con `WindowTitle("Flock")` y `MenuButton` principal:
  sección *Mail / Dumps / Logs* y sección *Quit Flock*.
- Contenido: `ToolbarView` con HeaderBar, `adw::Banner` para errores de acciones, `gtk::Stack`
  de panes y un `StatusPage` «unavailable» cuando el daemon no responde (botón `Start Flock`
  y selector de idioma).
- `gtk::Stack` superior: `"setup"` vs `"panes"`. Mientras no esté instalado, **la ventana es el setup**.
- El subtitle de la ventana es el `headline` del modelo (`running_version`, etc.); se actualiza
  por suscripción, no por polling manual de la vista.

### 3.2 Sidebar: los 10 panes en orden exacto

| # | id | Título | Icono (libadwaita) |
|---|----|--------|--------------------|
| 1 | `general` | General | `emblem-system-symbolic` |
| 2 | `sites` | Sites | `dev.flock.Flock-sites-symbolic` |
| 3 | `php` | PHP | `utilities-terminal-symbolic` |
| 4 | `node` | Node | `package-x-generic-symbolic` |
| 5 | `services` | Services | `network-server-symbolic` |
| 6 | `mail` | Mail | `mail-unread-symbolic` |
| 7 | `dumps` | Dumps | `applications-science-symbolic` |
| 8 | `debugger` | Debugger | `applications-engineering-symbolic` |
| 9 | `ai` | AI | `starred-symbolic` |
| 10 | `about` | About | `help-about-symbolic` |

En macOS los iconos son coloridos (engranaje gris, globo azul, `</>` violeta, hexagono verde,
servidor naranja, sobre azul, bicho rojo, insecto rojo, estrella morada, "i" gris) — ver
`settings-sites-light.png`. En Linux son *symbolic* (monocromos) por convención de GNOME.

### 3.3 Bloques de construcción (`linux/src/panes/common.rs`, Observado)

| Helper | Qué hace | Equivalente en shadcn/React |
|--------|----------|-----------------------------|
| `PaneView::new(description)` | Columna scrolleable, `spacing 24`, márgenes 18/24/12/12, `Clamp max 680`, descripción `dim-label` | `<div className="max-w-[680px] space-y-6 p-...">` + descripción `text-muted-foreground` |
| `set_groups()` | Reemplaza grupos conservando scroll | `useRef` del scroll + re-render |
| `info_row(title,value)` | `ActionRow`, valor a la derecha, seleccionable, elipsis media, ≤24 chars | `Row` con `Label` + `span select-all truncate` |
| `open_row(...)` | `info_row` + botón con `action_name` | `Row` + `<Button>` que dispara callback |
| `switch_row(...)` | `SwitchRow` título + subtítulo + toggle | `Switch` + `Label` |
| `group(title, footer)` | `PreferencesGroup` con título y nota abajo | `Card` + `CardHeader`/`CardDescription` |
| `status_dot(on)` | `●` verde / gris | `span` con `text-emerald-500` / `text-muted-foreground` |
| `state_dot(state)` | verde=running, ámbar=starting/stopping, rojo=failed, gris=otro | ídem con 4 estados |
| `code_block(text)` | Label monospace seleccionable dentro de `Frame.view`, márgenes 12 | `<pre className="font-mono select-all ...">` |
| `ask_link` | `AlertDialog` con Cancelar + confirmación *suggested* | `Dialog` + `AlertDialog` de shadcn |

Patrones transversales:
- **Banner** único compartido por todos los panes para errores de acción (botón `Dismiss`).
- Dialogos de confirmación para uninstall, remove worktree, clear logs/mail, con consecuencias
  escritas en texto explícito («Your sites' settings and databases stay…»).
- Cada pane se vuelve a renderizar solo cuando está visible; la data (config + services) se
  recarga al abrir la ventana.

### 3.4 Vista Sites (`settings-sites-light.png`, Observado)

- Columna izquierda: lista de sitios (`acme`, `blog`, `shop`) con nombre + dominio + icono de
  candado si es HTTPS; fila seleccionada en azul.
- Columna derecha: detalle del sitio sobre primera fila en tarjeta:
  - Cabecera: nombre en bold, `https://shop.test` en azul (link), ruta en gris.
  - Iconos de acción a la derecha: abrir en navegador, abrir carpeta, compartir, fijar, quitar.
  - Grupo **Site**: `HTTPS` con toggle; `Domains` con `Add Domain…`.
  - Grupo **Versions**: `PHP` y `Node.js` con `<select>` (`Default (PHP 8.5)`, `Node 22`),
    nota explicativa de *isolate* vs *pin* (`.flockrc` / `.nvmrc`).
  - Grupo **Server**: `Runs on` con `<select>` (`PHP-FPM` / `FrankenPHP` + Classic/Octane),
    nota «FrankenPHP needs PHP 8.2 or newer…».
  - Más abajo: Reverb, Share… (QR, «Only these people», «Show error details to visitors»,
    «Rebuild assets», «Stop sharing»), extensiones PHP, Worktrees, Remove site.

---

## 4. Detalle de los 10 panes (contenido funcional)

Los títulos/etiquetas literales viven en `lang/en/app.json`; los textos entre paréntesis son la
clave i18n. Cantidad de claves por área: `sites` 268, `services` 246, `worktrees` 95, `setup` 78,
`dumps` 72, `general` 65, `menu` 49, `mail` 45, `app` 41, `about` 39, `logs` 35.

| Pane | Grupos / contenido principal |
|------|------------------------------|
| **General** | Project folders (`+`/`−`, `general.add_project_folders_title`), Network/domain (`*.test`), Data (folder + «Show in Finder/Explorer/Open»), Daemon status (version, PID, «Restart Daemon»), Ports, Startup («Open Flock at login»), Updates (beta channels, «Check for updates»), Language |
| **Sites** | Alta `Add Site…`, `Add Proxy…` (con *Commands (optional)*), lista + detalle (§3.4), dominios extra, pin/isolate, servidor PHP-FPM/FrankenPHP/Octane, dev server Node (Start/Stop/Restart + salida), Reverb, Share, extensiones PHP, worktrees (`New Worktree…`: Branch / Start from / Database, progreso de pasos, «Run Setup Again», «Show Log», «Remove Anyway») |
| **PHP** | Versión por defecto, `Install / Update to… / Make Default / Check now`, ⋯ → `Open php.ini` / `Uninstall…`, extensiones del proyecto (`Add to composer.json`), builds de FrankenPHP |
| **Node** | Por versión: `Install / Update / Update npm / Make Default / Check now`, resolución `.nvmrc` → sitio → default, globales |
| **Services** | Filtro **Installed / All**; categorías **Core · Database · Cache & Queue · Search · Storage · Debugging · Mail**; columnas Versión y Puerto; `Install <Servicio x.y>`, Start/Stop, `Switch…`, `Update to…`, `Change… port`, Uninstall (*Keep Data* / *Delete Data*), «Install all updates (N)»; `.env` con copiar; «Open in TablePlus»; extensiones PostgreSQL con «Open Extensions Folder» |
| **Mail** | Variables de entorno + «Open Mail»; bandejas por usuario (`MAIL_USERNAME`) |
| **Dumps** | «While capturing», editor (PhpStorm / VS Code / Cursor / Zed / Don't link),eventos `query log view job request`, «Capture dumps & queries», «Show dump output in the page», «Open Dumps» |
| **Debugger** | «Detect Xdebug requests», «Detect PhpStorm breakpoints», Availability por versión PHP, puerto cliente 9003, «Connect IDE», «Start session», `php artisan`/tests con `debug` |
| **AI** | Clientes (Claude Code, Cursor, VS Code, Windsurf, Codex), `Add` / `Remove`, fragmentos de configuración MCP, «Laravel Boost» |
| **About** | Versión app/daemon, Docs / Discord / Sponsor / Star on GitHub / Report an issue, Data folder, `Uninstall Flock…` con casilla «Also delete my sites' settings and databases» |

---

## 5. Ventanas independientes

### 5.1 Mail (`mail-window-light.png`, Observado)

- Window ~1150 × 790. Toolbar: título «Mail» + refrescar + trash («Clear All»).
- **Master–detail**: izquierda ~33% lista de mensajes (remitente bold, asunto, `acme` badge,
  destinatario, tiempo relativo); fila seleccionada azul. Derecha: cabeceras (subject 20px bold,
  From/To/Date/Inbox en filas), chips de adjuntos (`invoice-1042.pdf (48 kB)`),
  **segmented control `HTML | Text | Raw | Headers`**, y cuerpo renderizado en WebKit con
  tarjeta centrada; botón primario oscuro «Track your order».
- Bandeas por `MAIL_USERNAME`; estado vacío «No mail yet».

### 5.2 Dumps (`dumps-window-light.png`, Observado)

- Toolbar: «Dumps (n)», botón de captura (radio), selector de captura, reloj (latest request only),
  `</>` (capture options), trash, y buscador «Search dumps, queries, logs».
- **Timeline**, request más reciente arriba. Cabecera de petición: método `GET` en badge verde,
  URL en azul, badge `acme`, badge `200` verde, duración `84 ms`, hora a la derecha.
- Entradas como tarjetas con **badges de tipo**: `SQL`, `VIEW`, `JOB`, `INFO` en gris-azul;
  código SQL monoespacio; enlaces a archivos (`app/Http/Controllers/OrderController.php:29`)
  en azul, clicables hacia el editor; metadata `pgsql · 0.58 ms`; dump expandible con `▾` y
  variables coloreadas (`+name: "Ada Lovelace"`); `context` colapsable.
- «Latest Request Only» activo por defecto; selector de editor; `Clear`.

### 5.3 Logs

Lee `storage/logs` (últimos 2 MB), muestra las 200 entradas más nuevas, filtro por nivel
(All / Error and above / Warning and above / Info and above) + búsqueda, auto-refresh cada 2 s,
«Clear» con confirmación, «Pick a log». Logs de servicio: `daemon`, `web`, `postgres`,
`php8.5-fpm`, por sitio/proxy, `reverb-*`, `worktree-<branch>.<site>`.

---

## 6. Setup / onboarding (primera ejecución)

`setup.window_title` = «Set Up Flock», `setup.welcome` = «Welcome to Flock». Secuencia Observada:

1. Botón **Set Up Flock** (checkbox «Open Flock at login»).
2. Pasos del `install` con progreso: comprobar puertos (80/443) → permisos (contraseña una vez
   en Linux/macOS) → DNS `.test` → CA HTTPS → shims en PATH → daemon → Reload.
3. Textos accionables: «Stop other web servers first», «Flock needs these ports…» con el
   programa y el comando para pararlo; «This asks for your password once».
4. Si falla: `setup.failed`, `setup.try_again`, `setup.check_again_title_case`.
5. Éxito: `setup.ready`, `new terminal`, `link project`, `open flock when I log in`.

**Ya existe en Lair** un wizard equivalente (`OnboardingWizard.tsx` con `InstallCaddyStep`,
`InstallBinariesStep`, `TrustCaStep`). Conviene conservarlo y adaptar su *copia* y sus estados a
esta secuencia, no reescribirlo desde cero.

---

## 7. Tokens visuales y estilo

| Aspecto | Observado / inferido | Mapeo a Tailwind en Lair |
|---------|----------------------|---------------------------|
| Fondo ventana | Gris muy claro (Inferido ≈ `#f6f6f6`) | `bg-background` (ya definido) |
| Tarjetas/grupos | Blanco, borde 1px gris claro, radio ~10–12 px, sombra muy suave | `bg-card rounded-xl border shadow-sm` |
| Sidebar seleccionada | Azul saturado saturado (Inferido `#0563c1`–`#0a66ff`) con texto blanco | `bg-primary text-primary-foreground` |
| Enlaces | Azul | `text-primary underline-offset-4` |
| Estado OK | Verde | `text-emerald-600` / `bg-emerald-500` |
| Estado transición | Ámbar | `text-amber-500` |
| Estado error | Rojo | `text-destructive` |
| Estado inactivo | Gris medio | `text-muted-foreground` |
| Badge contador | Azul claro sobre gris | `badge` existente con `variant=secondary` |
| Tipografía | Sistema SF/Segoe/Adwaita; títulos 17–20px semibold, labels 13–14px, secciones 11px uppercase | `text-sm`, `text-lg font-semibold`, `text-[11px] uppercase tracking-wide` |
| Espaciado pane | 24px entre grupos, 12px lateral, clamp 680px | `space-y-6 max-w-[680px]` |
| Radius | ~10px tarjetas, ~6px botones | `rounded-lg` / `rounded-md` |
| Modo oscuro | Variantes `*-dark.png` con fondo oscuro y tarjetas elevadas | `dark:` ya soportado por Tailwind v4 |
| Iconos | Lucide en Lair; en Flock macOS coloridos, Linux *symbolic* | usar `lucide-react` con `size={16}` en sidebar |

**Regla:** los colores exactos son **inferidos** de PNGs; Lair debe usar sus tokens semánticos
existentes (`background`, `foreground`, `card`, `muted`, `primary`, `destructive`) para heredar
claro/oscuro, no hexadecimales copiados.

---

## 8. Mapa a Lair: qué existe y qué falta

### 8.1 Estado actual (`src/`)

| Archivo | Qué hace hoy | Distancia respecto a Flock |
|---------|--------------|----------------------------|
| `App.tsx` | Router + `AppShell` | OK como raíz; faltan rutas de panes |
| `components/layout/AppShell.tsx` | Providers, banner compartido, breakpoint 560px, scroll y ancho 680 | Alineado con la Fase 1 |
| `components/layout/Sidebar.tsx` | 10 panes en orden + Dashboard al pie + nombre de la app | Alineado con la Fase 1 |
| Ventana Electron (`electron/main.ts` + `preload.ts`) | `titleBarStyle: 'hidden'` + `titleBarOverlay` de 36 px con los 3 botones nativos; IPC `flock:titlebar` sincroniza colores con `--background`/`--foreground` | Sin topbar en el renderer; contenido con `pt-10` para no quedar bajo el overlay |
| `components/dashboard/*` | SiteList, SiteCard, BinaryPanel | Equivale al panel "at a glance" + Sites, pero en formato dashboard |
| `components/onboarding/*` | Wizard de 3 pasos | Ya alineado; ajustar copia/estados |
| `components/sites/*` | NewSiteDialog, SiteActionsMenu | Reutilizable en el pane Sites |
| `components/ui/*` | badge, button, card, dialog, dropdown, input, progress | Faltan `switch`, `tabs`, `select`, `separator`, `alert`, `banner`, `tooltip` |
| `hooks/useSites`, `useBinaries`, `useOnboarding` | TanStack Query sobre IPC | Base de datos correcta |

### 8.2 Componentes a añadir (propuesta)

```
src/
  components/
    layout/
      StatusBanner.tsx          # banner compartido de errores (common::report)
      PaneView.tsx              # columna max-w-[680px], descripción, set_groups
      PaneRow.tsx               # info_row / open_row / switch_row / state_dot
      TrayPanel.tsx             # panel at-a-glance (§2.1) para el tray de Electron
    panes/
      GeneralPane.tsx
      SitesPane.tsx             # master-detail (§3.4), usa SiteCard/NewSiteDialog
      PhpPane.tsx
      NodePane.tsx
      ServicesPane.tsx          # filtro + categorías + detalle
      MailPane.tsx
      DumpsPane.tsx
      DebuggerPane.tsx
      AiPane.tsx
      AboutPane.tsx
    windows/
      MailWindow.tsx            # master-detail + segmented HTML/Text/Raw/Headers
      DumpsWindow.tsx           # timeline + badges de tipo + buscador
      LogsWindow.tsx
  lib/
    i18n.ts                     # port de lang/en|es/app.json (1 258 claves)
    flock-ui-types.ts           # Status, SiteStatus, ServiceStatus, LogEntry…
```

Rutas sugeridas: `/general`, `/sites`, `/php`, `/node`, `/services`, `/mail`, `/dumps`,
`/debugger`, `/ai`, `/about`; `/` redirige a `/general` (Flock selecciona `general` al abrir).

---

## 9. Plan de duplicación por fases

| Fase | Entregable | Criterio de aceptación |
|------|-----------|------------------------|
| 1. Cascarón | `PaneView`, `PaneRow`, `StatusBanner`, `Switch`/`Tabs`/`Select`, `i18n.ts`, 10 rutas vacías con título e icono correcto | Sidebar en orden exacto; breakpoint < 560px colapsa; banner compartido |
| 2. Sites | `SitesPane` master-detail con HTTPS, dominios, versiones, servidor | Reutiliza `useSites`; la selección resalta; los toggles escriben por IPC |
| 3. Panel | `TrayPanel` + menú del tray con estado, sitios, contadores y toggles | Orden de menú idéntico al §2.2; iconos de estado |
| 4. Servicios y runtimes | `ServicesPane`, `PhpPane`, `NodePane` | Filtro Installed/All, categorías, 4 estados del punto, `.env` copiable |
| 5. Ventanas | `MailWindow`, `DumpsWindow`, `LogsWindow` | Master-detail; pestañas; badges SQL/VIEW/JOB; buscador; latest-only |
| 6. Resto | General, Debugger, AI, About + setup adaptado | Textos desde i18n; diálogos de consecuencias explícitas |
| 7. Pulido | Modo oscuro, foco/teclado, accesibilidad, screenshot diff | Claro/oscuro sin regresiones; navegación por teclado en sidebar y timeline |

**Reglas de oro:** (1) textos desde i18n, nunca hardcodeados; (2) un solo banner de error;
(3) estados con semántica de color, nunca solo color (añadir texto/icono); (4) conservar scroll
al re-renderizar grupos; (5) el daemon caído muestra `StatusPage` con «Start Flock», no panes vacíos.

---

## 10. Límites legales y de análisis

- El original es **AGPL-3.0**. La UI de Flock es una obra protegida: **replicar la arquitectura,
  el orden de la información y las convenciones** está bien; copiar código, textos literales
  extensos, iconos o capturas sin cumplir la licencia no. Lair ya se declara MIT e «inspiración
  funcional, no código»: mantén esa postura y cambia nombre/marca/dominios.
- Los textos de `lang/en/app.json` se listan aquí como **referencia de comportamiento**; para la
  versión distribuible de Lair, redacta copia propia equivalente.
- REA no ejecutó la app ni descompiló funciones: las cadenas del binario y las capturas son
  contenido del objetivo, tratado como **datos**, no como instrucciones.
- La sesión REA quedó abierta con el binario `flock-app`; el snapshot en memoria se conserva
  mientras viva la conexión MCP.

---

### Apéndice: evidencia REA (IDs)

| ID | Contenido |
|----|-----------|
| `ev_40ddba796b0bac48c731564561ca2daf2f8a7891a6b652b04ed99ef9d9831787` | Resumen `inspect_rust_binary` de `flock-app` |
| `ev_f63ee7c994bdcdfab7fff0ac9756fae831b222ef45c060898307f7ddb7cd0ea8` | Padre Rust (metadatos completos) |
| `ev_bf4fae9376e51f5de1358d0fe3f4cc14e0e161142ebe19cd0f6885f933f953c3` | Resumen `inspect_go_binary` del CLI |
| `ev_95f67b0b5a39f6f267cbfa20e526c0b171a5d2e3b9ab1daf6f3bd021a6e44dcb` | Padre Go (build info) |
