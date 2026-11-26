import { createPublicKey, randomUUID, verify as verifySignature } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, ipcMain, shell } from 'electron'

interface LocalState {
  sites: Array<Record<string, unknown>>
  binaries: Array<Record<string, unknown>>
  caddy: Record<string, unknown>
  onboarding: Record<string, unknown>
}

interface BackendEnvelope {
  ok: boolean
  data?: unknown
  error?: { code: string; message: string }
}

interface BackendLike {
  invoke(cmd: string, argsJson: string): string | Promise<string>
}

interface Manifest {
  schema: number
  channel: string
  serial: number
  generated: string
  expires?: string
  packages: Record<string, Record<string, Record<string, {
    build: number
    url: string
    sha256: string
    size: number
    published: string
    lts?: boolean
    prerelease?: boolean
    yanked?: Record<string, string>
  }>>>
}

const MANIFEST_URL =
  'https://github.com/flock-php/binaries/releases/download/manifest/manifest.json'
const SIGNATURE_URL = `${MANIFEST_URL}.sig`
const MANIFEST_PUBLIC_KEY = 'kBKqgEsiOUOs9Dc5T7n0KdC7AqxtW2DTKzv3bb4Fhjc='

interface PackageVersion {
  package: string
  version: string
  build: number
  published: string
  lts: boolean
  prerelease: boolean
  yanked: boolean
}

/** Catálogo de respaldo mientras el addon nativo no esté compilado en este host. */
const DEMO_VERSIONS: PackageVersion[] = [
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

function platformKey(): string {
  if (process.platform === 'win32') return 'windows-x64'
  if (process.platform === 'darwin') return 'macos-arm64'
  return process.arch === 'arm64' ? 'linux-arm64' : 'linux-x64'
}

function manifestCacheDir(): string {
  return join(app.getPath('home'), '.local', 'share', 'lair', 'cache', 'binaries')
}

function readCachedManifest(): Manifest | null {
  try {
    const manifest = JSON.parse(
      readFileSync(join(manifestCacheDir(), 'manifest.json'), 'utf8'),
    ) as Manifest
    if (manifest.schema !== 1 || manifest.channel !== 'stable') return null
    if (manifest.expires && Date.parse(manifest.expires) < Date.now()) return null
    const serialPath = join(manifestCacheDir(), 'stable.serial')
    if (existsSync(serialPath)) {
      const last = Number(readFileSync(serialPath, 'utf8').trim())
      if (Number.isFinite(last) && manifest.serial < last) return null
    }
    return manifest
  } catch {
    return null
  }
}

/** Descarga y verifica el manifiesto firmado cuando el addon Rust no está disponible. */
async function ensureManifest(): Promise<Manifest | null> {
  const cached = readCachedManifest()
  if (cached) return cached
  try {
    const [manifestResponse, signatureResponse] = await Promise.all([
      fetch(MANIFEST_URL),
      fetch(SIGNATURE_URL),
    ])
    if (!manifestResponse.ok || !signatureResponse.ok) return null
    const bytes = Buffer.from(await manifestResponse.arrayBuffer())
    const signature = await signatureResponse.text()
    const der = Buffer.concat([
      Buffer.from('302a300506032b6570032100', 'hex'),
      Buffer.from(MANIFEST_PUBLIC_KEY, 'base64'),
    ])
    const key = createPublicKey({ key: der, format: 'der', type: 'spki' })
    if (!verifySignature(null, bytes, key, Buffer.from(signature.trim(), 'base64'))) return null

    const manifest = JSON.parse(bytes.toString('utf8')) as Manifest
    if (manifest.schema !== 1 || manifest.channel !== 'stable') return null
    if (manifest.expires && Date.parse(manifest.expires) < Date.now()) return null

    const serialPath = join(manifestCacheDir(), 'stable.serial')
    if (existsSync(serialPath)) {
      const last = Number(readFileSync(serialPath, 'utf8').trim())
      if (Number.isFinite(last) && manifest.serial < last) return null
    }
    mkdirSync(manifestCacheDir(), { recursive: true })
    writeFileSync(join(manifestCacheDir(), 'manifest.json'), bytes)
    writeFileSync(join(manifestCacheDir(), 'manifest.json.sig'), signature.trim())
    writeFileSync(serialPath, String(manifest.serial))
    return manifest
  } catch {
    return null
  }
}

async function listVersions(packageName?: string): Promise<PackageVersion[]> {
  const manifest = await ensureManifest()
  if (!manifest) return DEMO_VERSIONS.filter((item) => !packageName || item.package === packageName)

  const rows: PackageVersion[] = []
  for (const [pkg, versions] of Object.entries(manifest.packages ?? {})) {
    if (packageName && pkg !== packageName) continue
    for (const [version, platforms] of Object.entries(versions)) {
      const artifact = platforms[platformKey()]
      if (!artifact) continue
      rows.push({
        package: pkg,
        version,
        build: Number(artifact.build ?? 1),
        published: String(artifact.published ?? ''),
        lts: Boolean(artifact.lts),
        prerelease: Boolean(artifact.prerelease),
        yanked: Boolean(artifact.yanked && Object.keys(artifact.yanked).length > 0),
      })
    }
  }
  return rows.sort((a, b) => b.published.localeCompare(a.published))
}

const dataDir = app.getPath('userData')
const statePath = join(dataDir, 'flock-state.json')

function emptyState(): LocalState {
  return {
    sites: [],
    binaries: [
      { package: 'php', version: '8.4', installed: false, isDefault: false },
      { package: 'node', version: '22.11.0', installed: false, isDefault: false },
      { package: 'composer', version: '2.8.0', installed: false, isDefault: false },
    ],
    caddy: { installed: false, running: false, version: null, configPath: join(dataDir, 'Caddyfile') },
    onboarding: {
      caddyInstalled: false,
      binariesInstalled: false,
      caTrusted: false,
      completedAt: null,
    },
  }
}

function readState(): LocalState {
  if (!existsSync(statePath)) return emptyState()
  try {
    return JSON.parse(readFileSync(statePath, 'utf8')) as LocalState
  } catch {
    return emptyState()
  }
}

function writeState(state: LocalState): void {
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(statePath, JSON.stringify(state, null, 2))
}

/** napi-rs `Backend`; optional while the addon is not built on this host. */
const backend: BackendLike | null = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const native = require('../native') as { Backend?: new () => BackendLike }
    return native.Backend ? new native.Backend() : null
  } catch (error) {
    console.warn('[flock] native addon unavailable:', (error as Error).message)
    return null
  }
})()

function localInvoke(cmd: string, args: Record<string, unknown>): unknown {
  const state = readState()

  switch (cmd) {
    case 'list_sites':
      return state.sites
    case 'create_site': {
      const site = { ...args, id: randomUUID(), status: 'running' }
      state.sites.push(site)
      writeState(state)
      return site
    }
    case 'delete_site':
      state.sites = state.sites.filter((site) => site.id !== args.id)
      writeState(state)
      return { ok: true }
    case 'list_binaries':
      return state.binaries
    case 'list_versions':
      return listVersions(args.package as string | undefined)
    case 'install_binary': {
      const packageName = String(args.package)
      const version = String(args.version ?? 'stable')
      let binary = state.binaries.find(
        (item) => item.package === packageName && item.version === version,
      )
      if (!binary) {
        const hadDefault = state.binaries.some(
          (item) => item.package === packageName && item.isDefault,
        )
        binary = {
          package: packageName,
          version,
          platform: String(args.platform ?? platformKey()),
          installed: true,
          isDefault: !hadDefault,
          path: join(dataDir, 'versions', packageName, version),
          sha256: '',
        }
        state.binaries.push(binary)
      } else {
        binary.installed = true
      }
      state.onboarding.binariesInstalled = ['php', 'node'].every((name) =>
        state.binaries.some((item) => item.package === name && item.installed),
      )
      writeState(state)
      return { path: binary.path, sha256: '' }
    }
    case 'set_default_binary':
      for (const item of state.binaries) {
        if (item.package === args.package) {
          item.isDefault = item.version === args.version
        }
      }
      writeState(state)
      return { ok: true }
    case 'uninstall_binary':
      state.binaries = state.binaries.filter(
        (item) => !(item.package === args.package && item.version === args.version),
      )
      writeState(state)
      return { ok: true }
    case 'install_composer':
      return localInvoke('install_binary', { package: 'composer', version: 'stable' })
    case 'fetch_manifest':
      return {
        schema: 1,
        channel: 'stable',
        serial: 1,
        generated: new Date().toISOString(),
        packages: {},
      }
    case 'caddy_adapt':
      return {}
    case 'caddy_validate':
    case 'caddy_reload':
      return { ok: true }
    case 'caddy_trust':
      state.onboarding.caTrusted = true
      state.caddy = { ...state.caddy, installed: true, running: true, version: '2.9.0' }
      writeState(state)
      return { ok: true }
    case 'caddy_untrust':
      state.onboarding.caTrusted = false
      writeState(state)
      return { ok: true }
    case 'caddy_status':
      return state.caddy
    case 'get_onboarding':
      return state.onboarding
    case 'complete_onboarding':
      state.onboarding.completedAt = new Date().toISOString()
      writeState(state)
      return state.onboarding
    case 'reset_onboarding':
      state.onboarding = emptyState().onboarding
      writeState(state)
      return state.onboarding
    case 'open_site': {
      const url = new URL(String(args.url))
      void shell.openExternal(url.toString())
      return { ok: true }
    }
    case 'tail_logs':
      return { lines: [] }
    default:
      throw new Error(`Unknown command: ${cmd}`)
  }
}

export function registerIpcHandlers(): void {
  ipcMain.handle('flock:invoke', async (_event, cmd: string, argsJson: string) => {
    const args = JSON.parse(argsJson || '{}') as Record<string, unknown>
    if (!backend) return localInvoke(cmd, args)

    const raw = await backend.invoke(cmd, argsJson)
    const envelope = JSON.parse(raw) as BackendEnvelope
    if (!envelope.ok) {
      const error = new Error(envelope.error?.message ?? `Command ${cmd} failed`)
      ;(error as Error & { code?: string }).code = envelope.error?.code
      throw error
    }
    return envelope.data
  })

  ipcMain.handle('flock:openExternal', (_event, url: string) => shell.openExternal(url))
}
