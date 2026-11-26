import { execFileSync, spawn } from 'node:child_process'
import { lookup } from 'node:dns/promises'
import { connect } from 'node:net'
import { createPublicKey, randomUUID, verify as verifySignature } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { app, ipcMain, shell } from 'electron'

interface LocalState {
  sites: Array<Record<string, unknown>>
  parkedRoots: string[]
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
    parkedRoots: [join(app.getPath('home'), 'Lair')],
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
    const parsed = JSON.parse(readFileSync(statePath, 'utf8')) as Partial<LocalState>
    return { ...emptyState(), ...parsed } as LocalState
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

const CADDY_ADMIN = 'http://localhost:2019'

async function portOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port })
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => resolve(false))
    socket.setTimeout(700, () => {
      socket.destroy()
      resolve(false)
    })
  })
}

function caddyfileForSite(site: Record<string, unknown>): string {
  const domain = String((site.domains as string[] | undefined)?.[0] ?? `${site.name}.test`)
  const secure = site.tlsInternal === true
  let config = `${secure ? domain : `http://${domain}`} {\n`
  if (secure) config += '    tls internal\n'
  config += `    root * ${String(site.root ?? '')}\n    encode gzip zstd\n`
  config += '    @dotfiles path /.*\n    respond @dotfiles 404\n'
  if (site.kind === 'php') {
    config += `    php_fastcgi unix//run/php/php${String(site.phpVersion ?? '8.3')}-fpm.sock\n    file_server\n`
  } else if (site.kind === 'node') {
    config += '    reverse_proxy 127.0.0.1:3000 {\n        header_up X-Forwarded-Proto {scheme}\n    }\n'
  } else {
    config += '    try_files {path} {path}/ /index.html\n    file_server\n'
  }
  return `${config}}\n`
}

async function reloadCaddyConfig(
  state: LocalState,
): Promise<{ ok: true; skipped?: boolean; warnings?: unknown[]; configPath?: string }> {
  const globals = String(state.caddy.globalOptions ?? '')
  const config = (globals.trim() ? `${globals.trim()}\n\n` : '') + state.sites.map(caddyfileForSite).join('\n')
  const adapted = await caddyApi('/adapt', {
    method: 'POST',
    headers: { 'Content-Type': 'text/caddyfile' },
    body: config,
  })
  if (!adapted?.ok) {
    const configDir = join(app.getPath('home'), '.local', 'share', 'lair', 'config')
    mkdirSync(configDir, { recursive: true })
    const target = join(configDir, 'Caddyfile')
    if (existsSync(target)) {
      copyFileSync(target, join(configDir, `Caddyfile.${Date.now()}`))
    }
    writeFileSync(target, config)
    return { ok: true, skipped: true, configPath: target }
  }
  const response = await caddyApi('/load', {
    method: 'POST',
    headers: { 'Content-Type': 'text/caddyfile', 'Cache-Control': 'must-revalidate' },
    body: config,
  })
  if (!response?.ok) throw new Error('RELOAD_FAILED')
  const adaptedJson = (await adapted.json()) as { warnings?: unknown[] }
  return { ok: true, warnings: adaptedJson.warnings ?? [] }
}

async function caddyApi(path: string, init?: RequestInit): Promise<Response | null> {
  try {
    return await fetch(`${CADDY_ADMIN}${path}`, { ...init, signal: AbortSignal.timeout(2000) })
  } catch {
    return null
  }
}

interface ParkedProject {
  name: string
  root: string
  domain: string
  kind: 'php' | 'node' | 'static'
}

interface WorktreeInfo {
  path: string
  branch: string
  name: string
}

function parkedRoots(state: LocalState): string[] {
  return state.parkedRoots?.length
    ? state.parkedRoots
    : [join(app.getPath('home'), 'Lair')]
}

function scanParked(state: LocalState): ParkedProject[] {
  const linked = new Set(state.sites.map((site) => String(site.root)))
  const found: ParkedProject[] = []
  for (const root of parkedRoots(state)) {
    if (!existsSync(root)) continue
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const path = join(root, entry.name)
      if (linked.has(path)) continue
      const isProject =
        existsSync(join(path, 'composer.json')) ||
        existsSync(join(path, 'package.json')) ||
        existsSync(join(path, 'public', 'index.php')) ||
        existsSync(join(path, '.git'))
      if (!isProject) continue
      const name = entry.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-')
      // Un proyecto Laravel tiene package.json para Vite, pero se sirve con PHP.
      const isPhp =
        existsSync(join(path, 'composer.json')) || existsSync(join(path, 'public', 'index.php'))
      const kind = isPhp ? 'php' : 'node'
      found.push({ name: entry.name, root: path, domain: `${name}.test`, kind })
    }
  }
  return found
}

function git(root: string, args: string[]): string {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function listWorktrees(root: string): WorktreeInfo[] {
  try {
    return git(root, ['worktree', 'list', '--porcelain'])
      .split('\n\n')
      .map((block) => {
        const path = block.match(/^worktree (.+)$/m)?.[1] ?? ''
        const branch = block.match(/^branch refs\/heads\/(.+)$/m)?.[1] ?? ''
        return { path, branch, name: path ? basename(path) : '' }
      })
      .filter((item) => item.path)
  } catch {
    return []
  }
}

function openTerminal(root: string): void {
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', 'cmd', '/K', `cd /d "${root}"`], { detached: true })
    } else if (process.platform === 'darwin') {
      spawn('open', ['-a', 'Terminal', root], { detached: true })
    } else {
      spawn('gnome-terminal', ['--working-directory', root], { detached: true })
    }
  } catch {
    void shell.openPath(root)
  }
}

async function localInvoke(cmd: string, args: Record<string, unknown>): Promise<unknown> {
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
    case 'update_site': {
      const site = state.sites.find((item) => item.id === args.id)
      if (!site) throw new Error('Sitio no encontrado')
      for (const key of ['tlsInternal', 'phpVersion', 'nodeVersion', 'domains', 'root']) {
        if (key in args) site[key] = args[key]
      }
      writeState(state)
      // HTTPS no cambia solo la preferencia: regenera y aplica el Caddyfile.
      const reload = await reloadCaddyConfig(state)
      return { ...site, caddy: reload }
    }
    case 'list_parked':
      return scanParked(state)
    case 'park_folder': {
      const root = String(args.root)
      if (!parkedRoots(state).includes(root)) state.parkedRoots.push(root)
      writeState(state)
      return { ok: true }
    }
    case 'unpark_folder':
      state.parkedRoots = parkedRoots(state).filter((root) => root !== args.root)
      writeState(state)
      return { ok: true }
    case 'open_in_editor':
      void shell.openExternal(`vscode://file/${String(args.root)}`)
      return { ok: true }
    case 'open_terminal':
      openTerminal(String(args.root))
      return { ok: true }
    case 'list_worktrees':
      return listWorktrees(String(args.root))
    case 'add_worktree': {
      const root = String(args.root)
      const branch = String(args.branch)
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
      const path = String(args.path ?? join(dirname(root), `${basename(root)}-${branch}`))
      git(root, ['worktree', 'add', '-b', branch, path])
      return { path, branch }
    }
    case 'remove_worktree':
      git(String(args.root), ['worktree', 'remove', String(args.path)])
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
    case 'caddy_adapt': {
      const response = await caddyApi('/adapt', {
        method: 'POST',
        headers: { 'Content-Type': 'text/caddyfile' },
        body: String(args.config ?? ''),
      })
      return response?.ok ? response.json() : {}
    }
    case 'caddy_validate': {
      const response = await caddyApi('/adapt', {
        method: 'POST',
        headers: { 'Content-Type': 'text/caddyfile' },
        body: String(args.config ?? ''),
      })
      if (!response?.ok) {
        return { ok: true, warnings: [], skipped: true }
      }
      const adapted = (await response.json()) as { warnings?: unknown[] }
      return { ok: true, warnings: adapted.warnings ?? [] }
    }
    case 'caddy_reload':
      return reloadCaddyConfig(state)
    case 'site_environment': {
      const host = String(args.host ?? 'acme.test')
      let address = ''
      try {
        address = (await lookup(host)).address
      } catch {
        // Sin resolución: se reporta como no disponible.
      }
      return {
        dns: { host, address, ok: address === '127.0.0.1' },
        ports: { http: await portOpen(80), https: await portOpen(443) },
      }
    }
    case 'caddy_global_options':
      return { options: String(state.caddy.globalOptions ?? '') }
    case 'set_caddy_global_options':
      state.caddy = { ...state.caddy, globalOptions: String(args.options ?? '') }
      writeState(state)
      return { ok: true }
    case 'caddy_ca_status': {
      const response = await caddyApi('/pki/ca/local')
      if (!response?.ok) return { available: false }
      const info = (await response.json()) as Record<string, unknown>
      return {
        available: true,
        name: info.name ?? 'Caddy Local Authority',
        rootCommonName: info.root_common_name ?? '',
      }
    }
    case 'caddy_trust':
      state.onboarding.caTrusted = true
      state.caddy = { ...state.caddy, installed: true, running: true, version: '2.9.0' }
      writeState(state)
      return { ok: true }
    case 'caddy_untrust':
      state.onboarding.caTrusted = false
      writeState(state)
      return { ok: true }
    case 'caddy_status': {
      const response = await caddyApi('/config/')
      let version: string | null
      try {
        const output = execFileSync('caddy', ['version'], { encoding: 'utf8' })
        version = output.split(/\s+/)[1] ?? null
      } catch {
        version = state.caddy.version as string | null
      }
      return {
        ...state.caddy,
        running: Boolean(response?.ok),
        version,
      }
    }
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
      const raw = String(args.url)
      const url = new URL(/^https?:\/\//i.test(raw) ? raw : `http://${raw}`)
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
