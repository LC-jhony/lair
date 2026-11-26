import type {
  BinaryVersion,
  CaddyStatus,
  FlockBridge,
  ManifestInfo,
  NewSiteInput,
  OnboardingState,
  PackageVersion,
  Site,
  TitleBarColors,
  TrustCaResult,
} from './types'

interface DemoState {
  sites: Site[]
  binaries: BinaryVersion[]
  caddy: CaddyStatus
  onboarding: OnboardingState
}

const initialState: DemoState = {
  sites: [
    {
      id: 'demo-site',
      name: 'myapp',
      root: '~/Sites/myapp',
      kind: 'php',
      domains: ['myapp.test'],
      phpVersion: '8.4',
      tlsInternal: true,
      status: 'running',
    },
  ],
  binaries: [
    { package: 'php', version: '8.4', installed: false, isDefault: false },
    { package: 'node', version: '22.11.0', installed: false, isDefault: false },
    { package: 'composer', version: '2.8.0', installed: false, isDefault: false },
  ],
  caddy: {
    installed: false,
    running: false,
    version: null,
    configPath: '~/.config/flock/Caddyfile',
  },
  onboarding: {
    caddyInstalled: false,
    binariesInstalled: false,
    caTrusted: false,
    completedAt: null,
  },
}

/** Catálogo de demo del bridge de navegador; la app Electron lo lee del manifiesto firmado. */
const demoVersions: PackageVersion[] = [
  ...['8.3.37', '8.4.28', '8.5.13'].map((version) => ({
    package: 'php',
    version,
    build: 1,
    published: '2026-11-01T00:00:00Z',
    lts: false,
    prerelease: false,
    yanked: false,
  })),
  ...['20.20.2', '22.23.5', '24.22.3'].map((version) => ({
    package: 'node',
    version,
    build: 1,
    published: '2026-11-02T00:00:00Z',
    lts: true,
    prerelease: false,
    yanked: false,
  })),
  {
    package: 'composer',
    version: 'stable',
    build: 1,
    published: '2026-11-03T00:00:00Z',
    lts: false,
    prerelease: false,
    yanked: false,
  },
]

/** localStorage-backed bridge so the UI runs in a plain browser during development. */
function createBrowserBridge(): FlockBridge {
  const key = 'flock.demo.state'
  const read = (): DemoState => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as DemoState) : structuredClone(initialState)
    } catch {
      return initialState
    }
  }
  const write = (state: DemoState) => localStorage.setItem(key, JSON.stringify(state))
  const delay = <T>(value: T): Promise<T> =>
    new Promise((resolve) => setTimeout(() => resolve(value), 120))

  return {
    onEvent: () => () => {},
    setTitleBarColors: () => {},
    invoke: <T>(cmd: string, args?: unknown): Promise<T> => {
      const state = read()
      const payload = (args ?? {}) as Record<string, unknown>

      switch (cmd) {
        case 'list_sites':
          return delay(state.sites) as Promise<T>
        case 'create_site': {
          const site: Site = {
            ...(payload as unknown as NewSiteInput),
            id: crypto.randomUUID(),
            status: 'running',
          }
          state.sites.push(site)
          write(state)
          return delay(site) as Promise<T>
        }
        case 'delete_site':
          state.sites = state.sites.filter((site) => site.id !== payload.id)
          write(state)
          return delay({ ok: true }) as Promise<T>
        case 'list_binaries':
          return delay(state.binaries) as Promise<T>
        case 'list_versions': {
          const packageName = payload.package as string | undefined
          const rows = demoVersions
            .filter((item) => !packageName || item.package === packageName)
            .sort((a, b) => b.published.localeCompare(a.published))
          return delay(rows) as Promise<T>
        }
        case 'install_binary': {
          const packageName = String(payload.package)
          const version = String(payload.version ?? 'stable')
          const existing = state.binaries.find(
            (item) => item.package === packageName && item.version === version,
          )
          if (!existing) {
            const hadDefault = state.binaries.some(
              (item) => item.package === packageName && item.isDefault,
            )
            state.binaries.push({
              package: packageName,
              version,
              installed: true,
              isDefault: !hadDefault,
              platform: String(payload.platform ?? 'linux-x64'),
              path: `~/.local/share/lair/versions/${packageName}/${version}`,
              sha256: 'demo',
            })
          } else {
            existing.installed = true
          }
          state.onboarding.binariesInstalled = ['php', 'node'].every((name) =>
            state.binaries.some((item) => item.package === name && item.installed),
          )
          write(state)
          return delay({
            path: `~/.local/share/lair/versions/${packageName}/${version}`,
            sha256: 'demo',
          }) as Promise<T>
        }
        case 'set_default_binary': {
          for (const item of state.binaries) {
            if (item.package === payload.package) {
              item.isDefault = item.version === payload.version
            }
          }
          write(state)
          return delay({ ok: true }) as Promise<T>
        }
        case 'uninstall_binary': {
          state.binaries = state.binaries.filter(
            (item) =>
              !(
                item.package === payload.package &&
                item.version === payload.version
              ),
          )
          write(state)
          return delay({ ok: true }) as Promise<T>
        }
        case 'install_composer': {
          if (!state.binaries.some((item) => item.package === 'composer')) {
            state.binaries.push({
              package: 'composer',
              version: 'stable',
              installed: true,
              isDefault: true,
              platform: currentPlatform(),
              path: '~/.local/share/lair/versions/composer/stable',
              sha256: 'demo',
            })
            write(state)
          }
          return delay({
            path: '~/.local/share/lair/versions/composer/stable',
            sha256: 'demo',
          }) as Promise<T>
        }
        case 'fetch_manifest':
          return delay({
            schema: 1,
            channel: 'stable',
            serial: 1,
            generated: new Date().toISOString(),
            packages: {},
          }) as Promise<T>
        case 'caddy_adapt':
          return delay({}) as Promise<T>
        case 'caddy_validate':
        case 'caddy_reload':
          return delay({ ok: true }) as Promise<T>
        case 'caddy_trust':
          state.onboarding.caTrusted = true
          state.caddy.installed = true
          state.caddy.running = true
          state.caddy.version = '2.9.0'
          write(state)
          return delay({ ok: true }) as Promise<T>
        case 'caddy_untrust':
          state.onboarding.caTrusted = false
          write(state)
          return delay({ ok: true }) as Promise<T>
        case 'caddy_status':
          return delay(state.caddy) as Promise<T>
        case 'get_onboarding':
          return delay(state.onboarding) as Promise<T>
        case 'complete_onboarding':
          state.onboarding.completedAt = new Date().toISOString()
          write(state)
          return delay(state.onboarding) as Promise<T>
        case 'reset_onboarding':
          state.onboarding = { ...initialState.onboarding }
          write(state)
          return delay(state.onboarding) as Promise<T>
        case 'open_site':
          window.open(`http://${String(payload.url)}`, '_blank', 'noopener')
          return delay({ ok: true }) as Promise<T>
        case 'tail_logs':
          return delay({ lines: [] }) as Promise<T>
        default:
          return Promise.reject(new Error(`Unknown command: ${cmd}`))
      }
    },
  }
}

const bridge: FlockBridge = window.flock ?? createBrowserBridge()

function currentPlatform(): string {
  const agent = navigator.userAgent.toLowerCase()
  if (agent.includes('mac')) return 'macos-arm64'
  if (agent.includes('win')) return 'windows-x64'
  return 'linux-x64'
}

/** Sincroniza los colores del overlay nativo con el tema de la app. */
export function setTitleBarColors(colors: TitleBarColors): void {
  bridge.setTitleBarColors?.(colors)
}

/** Low-level typed command API (README §7). */
export const ipc = {
  listSites: () => bridge.invoke<Site[]>('list_sites'),
  createSite: (payload: NewSiteInput) => bridge.invoke<Site>('create_site', payload),
  deleteSite: (id: string) => bridge.invoke<{ ok: true }>('delete_site', { id }),
  listBinaries: () => bridge.invoke<BinaryVersion[]>('list_binaries'),
  installBinary: (payload: { package: string; version: string; platform: string }) =>
    bridge.invoke<{ path: string; sha256: string }>('install_binary', payload),
  listVersions: (packageName?: string) =>
    bridge.invoke<PackageVersion[]>('list_versions', packageName ? { package: packageName } : {}),
  setDefaultBinary: (payload: { package: string; version: string; platform: string }) =>
    bridge.invoke<{ ok: true }>('set_default_binary', payload),
  uninstallBinary: (payload: { package: string; version: string; platform: string }) =>
    bridge.invoke<{ ok: true }>('uninstall_binary', payload),
  installComposer: () => bridge.invoke<{ path: string; sha256: string }>('install_composer'),
  fetchManifest: () => bridge.invoke<ManifestInfo>('fetch_manifest'),
  caddyAdapt: (config: string) => bridge.invoke<unknown>('caddy_adapt', { config }),
  caddyValidate: (config: string) => bridge.invoke<{ ok: true }>('caddy_validate', { config }),
  caddyReload: (config: string) => bridge.invoke<{ ok: true }>('caddy_reload', { config }),
  caddyTrust: () => bridge.invoke<{ ok: true }>('caddy_trust'),
  caddyUntrust: () => bridge.invoke<{ ok: true }>('caddy_untrust'),
  openSite: (url: string) => bridge.invoke<{ ok: true }>('open_site', { url }),
  tailLogs: (siteId: string) => bridge.invoke<{ lines: string[] }>('tail_logs', { siteId }),
  // UI extensions (not in the README command table):
  caddyStatus: () => bridge.invoke<CaddyStatus>('caddy_status'),
  getOnboarding: () => bridge.invoke<OnboardingState>('get_onboarding'),
  completeOnboarding: () => bridge.invoke<OnboardingState>('complete_onboarding'),
  resetOnboarding: () => bridge.invoke<OnboardingState>('reset_onboarding'),
}

/** Domain-level API consumed by hooks. */
export const flock = {
  sites: {
    list: ipc.listSites,
    create: ipc.createSite,
    remove: ipc.deleteSite,
  },
  binaries: {
    list: ipc.listBinaries,
    versions: (packageName?: string) => ipc.listVersions(packageName),
    install: (payload: { package: string; version: string }) =>
      ipc.installBinary({ ...payload, platform: currentPlatform() }),
    setDefault: (payload: { package: string; version: string }) =>
      ipc.setDefaultBinary({ ...payload, platform: currentPlatform() }),
    uninstall: (payload: { package: string; version: string }) =>
      ipc.uninstallBinary({ ...payload, platform: currentPlatform() }),
    installComposer: ipc.installComposer,
    /** Compatibilidad con el onboarding: instala la versión más reciente del paquete. */
    installLatest: async (id: string) => {
      const versions = await ipc.listVersions(id)
      return ipc.installBinary({
        package: id,
        version: versions.find((item) => !item.prerelease && !item.yanked)?.version ?? 'stable',
        platform: currentPlatform(),
      })
    },
  },
  caddy: {
    status: ipc.caddyStatus,
    install: async () => {
      await ipc.caddyTrust()
      return ipc.caddyStatus()
    },
    trustCa: async (): Promise<TrustCaResult> => {
      await ipc.caddyTrust()
      return { trusted: true, detail: 'CA added to the local trust store' }
    },
  },
  manifest: { get: ipc.fetchManifest },
  onboarding: {
    get: ipc.getOnboarding,
    complete: ipc.completeOnboarding,
    reset: ipc.resetOnboarding,
  },
}
