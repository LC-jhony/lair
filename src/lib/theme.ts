/**
 * Tema de la app con tres modos: `light`, `dark` y `system`.
 * `system` sigue `prefers-color-scheme` en tiempo real y aplica la clase `.dark`
 * que ya consume `@custom-variant dark` en index.css.
 */

import type { TitleBarColors } from './types'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'flock.theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

export function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function getStoredMode(): ThemeMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return isThemeMode(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

export function persistMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // Almacenamiento bloqueado: el tema sigue funcionando durante la sesión.
  }
}

export function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(DARK_QUERY).matches
}

export function resolveDark(mode: ThemeMode, systemDark: boolean): boolean {
  if (mode === 'light') return false
  if (mode === 'dark') return true
  return systemDark
}

export function applyTheme(mode: ThemeMode, dark: boolean): void {
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
  root.dataset.theme = mode
}

/** Colores del overlay nativo tomados de los tokens activos, nunca hex fijos. */
export function readTitleBarColors(mode: ThemeMode): TitleBarColors {
  const style = getComputedStyle(document.documentElement)
  const color = style.getPropertyValue('--background').trim() || '#fafafa'
  const symbolColor = style.getPropertyValue('--foreground').trim() || '#18181b'
  return { color, symbolColor, mode }
}

export function subscribeToSystemTheme(onChange: (dark: boolean) => void): () => void {
  const query = window.matchMedia(DARK_QUERY)
  const handler = (event: MediaQueryListEvent) => onChange(event.matches)
  query.addEventListener('change', handler)
  return () => query.removeEventListener('change', handler)
}
