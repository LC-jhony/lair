/**
 * Capa i18n mínima para la UI.
 *
 * Las claves y la estructura (prefijos `general.`, `settings.pane.*`, `menu.*`, …) replican la
 * arquitectura de texto de Flock para que los panes puedan migrar a un catálogo completo sin
 * cambiar llamadas. Los textos son propios de Lair: no se copian los literales del original.
 * Cuando haya un catálogo completo, sustituir `dictionaries` por `lang/<locale>/app.json`.
 */

export type Locale = 'en' | 'es'

type Dictionary = Record<string, string>

const en: Dictionary = {
  'app.name': 'Flock Herd',
  'app.version': 'v0.1.0',
  'app.running_version': 'Running · {version}',
  'app.needs_attention_version': 'Needs attention · {version}',

  'settings.pane.general': 'General',
  'settings.pane.sites': 'Sites',
  'settings.pane.php': 'PHP',
  'settings.pane.node': 'Node',
  'settings.pane.services': 'Services',
  'settings.pane.mail': 'Mail',
  'settings.pane.dumps': 'Dumps',
  'settings.pane.debugger': 'Debugger',
  'settings.pane.ai': 'AI',
  'settings.pane.about': 'About',

  'general.subtitle': 'The local daemon runs your sites, PHP versions and services in the background.',
  'sites.subtitle': 'Sites you added one by one, plus every folder inside your project folders.',
  'php.subtitle': 'Every installed version runs its own pool of PHP workers. Sites use the default unless pinned.',
  'node.subtitle': 'node, npm and npx follow the project’s .nvmrc / .node-version, then the site’s version, then the default.',
  'services.subtitle': 'Databases, caches, search and the tools around your sites. Everything listens on 127.0.0.1 only.',
  'mail.subtitle': 'Mail catches every email your apps send — nothing leaves your computer.',
  'dumps.subtitle': 'Events, queries, logs, views and jobs from your requests and commands.',
  'debugger.subtitle': 'Step through requests and commands with Xdebug.',
  'ai.subtitle': 'Let AI agents work with your sites: URLs, PHP versions, logs, dumps and mail.',
  'about.subtitle': 'A native local development environment inspired by Laravel Valet and Herd.',

  'pane.planned': 'Planned for this pane',
  'pane.phase': 'Phase {n}',
  'pane.back': 'Back',
  'banner.dismiss': 'Dismiss',
  'banner.error': 'The last action failed',
  'banner.notice': 'Information',

  'theme.label': 'Appearance',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.system': 'System',

  'settings.flock_is_not_running': 'Lair Is Not Running',
  'settings.start_daemon_to_change': 'Start the daemon to change its settings.',
  'menu.start_flock': 'Start Lair',
  'menu.restart_flock': 'Restart Lair',

  'general.group.projects': 'Project folders',
  'general.group.daemon': 'Daemon',
  'general.group.data': 'Data',
  'general.group.network': 'Network',
  'general.group.startup': 'Startup',
  'sites.group.list': 'Your sites',
  'sites.group.add': 'Add site',
  'php.group.versions': 'PHP versions',
  'node.group.versions': 'Node versions',
  'services.group.filters': 'Filters',
  'services.group.installed': 'Installed services',
  'mail.group.inbox': 'Inbox',
  'dumps.group.timeline': 'Timeline',
  'dumps.group.capture': 'Capture',
  'debugger.group.xdebug': 'Xdebug',
  'ai.group.clients': 'AI clients',
  'about.group.app': 'Application',
  'about.group.support': 'Support',
}

const es: Dictionary = {
  'app.name': 'Flock Herd',
  'app.version': 'v0.1.0',
  'app.running_version': 'En ejecución · {version}',
  'app.needs_attention_version': 'Requiere atención · {version}',

  'settings.pane.general': 'General',
  'settings.pane.sites': 'Sitios',
  'settings.pane.php': 'PHP',
  'settings.pane.node': 'Node',
  'settings.pane.services': 'Servicios',
  'settings.pane.mail': 'Correo',
  'settings.pane.dumps': 'Dumps',
  'settings.pane.debugger': 'Depurador',
  'settings.pane.ai': 'IA',
  'settings.pane.about': 'Acerca de',

  'general.subtitle': 'El daemon local ejecuta tus sitios, versiones de PHP y servicios en segundo plano.',
  'sites.subtitle': 'Sitios que añadiste uno a uno y todas las carpetas dentro de tus carpetas de proyecto.',
  'php.subtitle': 'Cada versión instalada ejecuta su propio pool de workers. Los sitios usan la predeterminada salvo que fijen otra.',
  'node.subtitle': 'node, npm y npx siguen el .nvmrc / .node-version del proyecto, luego la versión del sitio y por último la predeterminada.',
  'services.subtitle': 'Bases de datos, cachés, búsqueda y herramientas para tus sitios. Todo escucha solo en 127.0.0.1.',
  'mail.subtitle': 'Correo captura cada email que envían tus apps; nada sale de tu equipo.',
  'dumps.subtitle': 'Eventos, consultas, logs, vistas y trabajos de tus peticiones y comandos.',
  'debugger.subtitle': 'Recorre peticiones y comandos con Xdebug.',
  'ai.subtitle': 'Permite que agentes de IA trabajen con tus sitios: URLs, versiones de PHP, logs, dumps y correo.',
  'about.subtitle': 'Un entorno de desarrollo local inspirado en Laravel Valet y Herd.',

  'pane.planned': 'Previsto para este panel',
  'pane.phase': 'Fase {n}',
  'pane.back': 'Atrás',
  'banner.dismiss': 'Descartar',
  'banner.error': 'La última acción falló',
  'banner.notice': 'Información',

  'theme.label': 'Apariencia',
  'theme.light': 'Claro',
  'theme.dark': 'Oscuro',
  'theme.system': 'Sistema',

  'settings.flock_is_not_running': 'Lair no está en ejecución',
  'settings.start_daemon_to_change': 'Inicia el daemon para cambiar su configuración.',
  'menu.start_flock': 'Iniciar Lair',
  'menu.restart_flock': 'Reiniciar Lair',

  'general.group.projects': 'Carpetas de proyecto',
  'general.group.daemon': 'Daemon',
  'general.group.data': 'Datos',
  'general.group.network': 'Red',
  'general.group.startup': 'Inicio',
  'sites.group.list': 'Tus sitios',
  'sites.group.add': 'Añadir sitio',
  'php.group.versions': 'Versiones de PHP',
  'node.group.versions': 'Versiones de Node',
  'services.group.filters': 'Filtros',
  'services.group.installed': 'Servicios instalados',
  'mail.group.inbox': 'Bandeja de entrada',
  'dumps.group.timeline': 'Línea de tiempo',
  'dumps.group.capture': 'Captura',
  'debugger.group.xdebug': 'Xdebug',
  'ai.group.clients': 'Clientes de IA',
  'about.group.app': 'Aplicación',
  'about.group.support': 'Soporte',
}

const dictionaries: Record<Locale, Dictionary> = { en, es }

function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en'
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
}

let locale: Locale = detectLocale()

export function getLocale(): Locale {
  return locale
}

export function setLocale(next: Locale): void {
  locale = next
}

/** Traduce una clave e interpela variables `{nombre}`. Las claves ausentes devuelven la clave. */
export function tr(key: string, vars?: Record<string, string | number>): string {
  const template = dictionaries[locale][key] ?? en[key] ?? key
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name]
    return value === undefined ? match : String(value)
  })
}
