import { describe, expect, it } from 'vitest'
import { isFullyInstalled, missingPackages } from '../../src/lib/onboarding'
import type { BinaryVersion, OnboardingState } from '../../src/lib/types'

function binary(packageName: string, version: string, installed: boolean): BinaryVersion {
  return { package: packageName, version, installed, isDefault: installed }
}

function state(overrides: Partial<OnboardingState> = {}): OnboardingState {
  return {
    caddyInstalled: true,
    binariesInstalled: true,
    caTrusted: true,
    completedAt: null,
    ...overrides,
  }
}

describe('missingPackages', () => {
  it('no reinstala un paquete que ya tiene otra versión instalada', () => {
    expect(missingPackages([
      binary('php', '8.4', false),
      binary('php', '8.4.28', true),
      binary('node', '22.11.0', false),
      binary('node', '26.13.1', true),
    ])).toEqual([])
  })

  it('solo pide paquetes sin ninguna versión instalada, excluyendo Composer', () => {
    expect(missingPackages([
      binary('composer', '2.8.0', false),
      binary('php', '8.4', false),
      binary('node', '26.13.1', true),
    ])).toEqual(['php'])
  })
})

describe('isFullyInstalled', () => {
  it('da por terminado el onboarding aunque completedAt no se haya guardado', () => {
    expect(isFullyInstalled(state())).toBe(true)
  })

  it('sigue requiriendo pasos cuando falta algo', () => {
    expect(isFullyInstalled(state({ caTrusted: false }))).toBe(false)
    expect(isFullyInstalled(state({ binariesInstalled: false }))).toBe(false)
    expect(isFullyInstalled(null)).toBe(false)
  })
})
