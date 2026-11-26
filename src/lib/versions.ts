import type { PackageVersion } from './types'

export interface VersionGroup {
  package: string
  /** Línea publicada: `8.5`, `22`, `stable`… */
  minor: string
  /** Parche más reciente de la línea, listo para instalar. */
  latest: PackageVersion
  /** Todos los parches de la línea, del más reciente al más antiguo. */
  patches: PackageVersion[]
}

/** Compara la parte numérica de dos versiones (`8.5.13` > `8.5.12`). */
export function compareVersions(a: string, b: string): number {
  const left = a.match(/\d+/g)?.map(Number) ?? []
  const right = b.match(/\d+/g)?.map(Number) ?? []
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

/** `8.5.13` → `8.5`; `22.23.5` → `22`; `stable` → `stable`. */
export function minorOf(version: string): string {
  const parts = version.split('.')
  return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : version
}

/** Paquetes cuyas líneas son el número mayor (Node 24, PostgreSQL 18, MongoDB 9…). */
const MAJOR_LINE_PACKAGES = new Set([
  'node',
  'postgres',
  'mongodb',
  'meilisearch',
  'typesense',
  'rustfs',
  'cloudflared',
])

/** Node/Postgres/MongoDB agrupan por mayor; PHP, FrankenPHP, MySQL y el resto por minor. */
export function versionLine(packageName: string, version: string): string {
  if (MAJOR_LINE_PACKAGES.has(packageName)) return version.split('.')[0]
  return minorOf(version)
}

/**
 * Agrupa los artefactos publicados por línea, dejando una sola fila por línea.
 * Flock hace lo mismo en el pane PHP: `PHP 8.5` con el parche vigente a la derecha.
 */
export function groupByMinor(versions: PackageVersion[]): VersionGroup[] {
  const byMinor = new Map<string, PackageVersion[]>()
  for (const version of versions) {
    const minor = versionLine(version.package, version.version)
    const existing = byMinor.get(minor)
    if (existing) existing.push(version)
    else byMinor.set(minor, [version])
  }

  return Array.from(byMinor, ([minor, patches]) => {
    const sorted = [...patches].sort((a, b) => {
      const byDate = b.published.localeCompare(a.published)
      return byDate !== 0 ? byDate : compareVersions(b.version, a.version) || b.build - a.build
    })
    return {
      package: sorted[0].package,
      minor,
      latest: sorted[0],
      patches: sorted,
    }
  }).sort((a, b) => {
    const left = a.minor.match(/\d+/g)?.map(Number) ?? []
    const right = b.minor.match(/\d+/g)?.map(Number) ?? []
    if (left.length === 0 || right.length === 0) {
      if (left.length === right.length) return a.minor.localeCompare(b.minor)
      return left.length === 0 ? 1 : -1
    }
    for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
      const difference = (right[index] ?? 0) - (left[index] ?? 0)
      if (difference !== 0) return difference
    }
    return 0
  })
}
