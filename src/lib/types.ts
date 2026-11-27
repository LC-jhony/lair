/** Shared contracts. Commands follow the `flock:invoke` protocol in the README. */

export type SiteKind = 'php' | 'node' | 'static'
export type SiteStatus = 'running' | 'stopped' | 'error'

export interface Site {
  id: string
  name: string
  root: string
  kind: SiteKind
  domains: string[]
  phpVersion?: string
  nodeVersion?: string
  tlsInternal: boolean
  /** UI-only state derived from the active Caddy config. */
  status?: SiteStatus
}

export interface NewSiteInput {
  name: string
  root: string
  kind: SiteKind
  domains: string[]
  phpVersion?: string
  nodeVersion?: string
  tlsInternal: boolean
}

export interface PathStatus {
  dir: string
  inEnv: boolean
  profiles: string[]
  ok: boolean
}

export interface BinaryCheck {
  package: string
  ok: boolean
  version: string | null
}

export interface SiteEnvironment {
  dns: { host: string; address: string; ok: boolean }
  ports: { http: boolean; https: boolean }
}

export interface ParkedProject {
  name: string
  root: string
  domain: string
  kind: SiteKind
}

export interface WorktreeInfo {
  path: string
  branch: string
  name: string
}

export interface BinaryVersion {
  package: string
  version: string
  installed: boolean
  isDefault: boolean
  platform?: string
  path?: string
  sha256?: string
}

export interface PackageVersion {
  package: string
  version: string
  build: number
  published: string
  lts: boolean
  prerelease: boolean
  yanked: boolean
}

export interface ManifestInfo {
  schema: number
  channel: string
  serial: number
  generated: string
  expires?: string | null
  packages: Record<string, unknown>
}

export interface CaddyStatus {
  installed: boolean
  running: boolean
  version: string | null
  configPath: string | null
  caTrusted?: boolean
  globalOptions?: string
}

export interface CaStatus {
  available: boolean
  name: string
  rootCommonName: string
}

export interface TrustCaResult {
  trusted: boolean
  detail: string
}

export interface OnboardingState {
  caddyInstalled: boolean
  binariesInstalled: boolean
  caTrusted: boolean
  completedAt: string | null
}

/** Bridge exposed by `electron/preload.ts`. */
export interface TitleBarColors {
  color: string
  symbolColor: string
  mode: 'light' | 'dark' | 'system'
}

export interface FlockBridge {
  invoke<T = unknown>(cmd: string, args?: unknown): Promise<T>
  onEvent(callback: (event: unknown) => void): () => void
  setTitleBarColors?: (colors: TitleBarColors) => void
}

declare global {
  interface Window {
    flock?: FlockBridge
  }
}
