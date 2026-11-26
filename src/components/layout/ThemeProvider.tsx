import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  applyTheme,
  getStoredMode,
  persistMode,
  prefersDark,
  readTitleBarColors,
  resolveDark,
  subscribeToSystemTheme,
} from '@/lib/theme'
import type { ThemeMode } from '@/lib/theme'
import { setTitleBarColors } from '@/lib/ipc'

interface ThemeValue {
  mode: ThemeMode
  dark: boolean
  setMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getStoredMode)
  const [systemDark, setSystemDark] = useState(prefersDark)

  useEffect(() => subscribeToSystemTheme(setSystemDark), [])

  const dark = resolveDark(mode, systemDark)
  useEffect(() => {
    applyTheme(mode, dark)
    setTitleBarColors(readTitleBarColors(mode))
  }, [mode, dark])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    persistMode(next)
  }, [])

  const value = useMemo(() => ({ mode, dark, setMode }), [mode, dark, setMode])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme debe usarse dentro de ThemeProvider')
  return value
}
