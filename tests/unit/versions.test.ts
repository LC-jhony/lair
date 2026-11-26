import { describe, expect, it } from 'vitest'
import { compareVersions, groupByMinor, minorOf, versionLine } from '../../src/lib/versions'
import type { PackageVersion } from '../../src/lib/types'

function version(packageName: string, value: string, published: string): PackageVersion {
  return {
    package: packageName,
    version: value,
    build: 1,
    published,
    lts: false,
    prerelease: false,
    yanked: false,
  }
}

describe('minorOf', () => {
  it('reduce un parche a su línea y respeta versiones sin puntos', () => {
    expect(minorOf('8.5.13')).toBe('8.5')
    expect(minorOf('22.23.5')).toBe('22.23')
    expect(minorOf('stable')).toBe('stable')
  })
})

describe('versionLine', () => {
  it('usa el mayor para Node/Postgres y el minor para PHP/MySQL', () => {
    expect(versionLine('node', '22.23.5')).toBe('22')
    expect(versionLine('postgres', '18.7')).toBe('18')
    expect(versionLine('php', '8.5.13')).toBe('8.5')
    expect(versionLine('mysql', '8.4.11')).toBe('8.4')
  })
})

describe('compareVersions', () => {
  it('ordena parches numéricamente', () => {
    expect(compareVersions('8.5.13', '8.5.12')).toBeGreaterThan(0)
    expect(compareVersions('8.4.28', '8.5.13')).toBeLessThan(0)
  })
})

describe('groupByMinor', () => {
  it('agrupa los parches de una misma línea en una sola fila con el más reciente', () => {
    const groups = groupByMinor([
      version('php', '8.5.11', '2026-10-25T00:00:00Z'),
      version('php', '8.5.13', '2026-11-20T00:00:00Z'),
      version('php', '8.5.12', '2026-11-01T00:00:00Z'),
      version('php', '8.4.28', '2026-11-20T00:00:00Z'),
    ])

    expect(groups).toHaveLength(2)
    expect(groups[0].minor).toBe('8.5')
    expect(groups[0].latest.version).toBe('8.5.13')
    expect(groups[0].patches.map((item) => item.version)).toEqual([
      '8.5.13',
      '8.5.12',
      '8.5.11',
    ])
    expect(groups[1].minor).toBe('8.4')
  })

  it('ordena las líneas de mayor a menor', () => {
    const groups = groupByMinor([
      version('node', '20.20.2', '2026-10-01T00:00:00Z'),
      version('node', '24.22.3', '2026-11-01T00:00:00Z'),
      version('node', '22.23.5', '2026-11-02T00:00:00Z'),
    ])
    expect(groups.map((group) => group.minor)).toEqual(['24', '22', '20'])
  })
})
