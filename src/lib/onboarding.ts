import type { BinaryVersion, OnboardingState } from './types'

/**
 * Paquetes que aún no tienen ninguna versión instalada.
 * Las entradas obsoletas (`php 8.4` sin instalar) no deben provocar una
 * nueva descarga cuando ya existe una versión más reciente instalada.
 */
export function missingPackages(binaries: BinaryVersion[]): string[] {
  return [...new Set(binaries.map((item) => item.package))].filter(
    (name) => name !== 'composer' && !binaries.some((item) => item.package === name && item.installed),
  )
}

/** Estado íntegro aunque falte el sello `completedAt` de un arranque anterior. */
export function isFullyInstalled(state?: OnboardingState | null): boolean {
  return Boolean(
    state?.caddyInstalled && state.binariesInstalled && state.caTrusted,
  )
}
