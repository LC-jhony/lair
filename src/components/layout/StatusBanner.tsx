import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { tr } from '@/lib/i18n'

interface StatusBannerValue {
  error: string | null
  /** Muestra un error; `null` lo oculta. Un mismo mensaje no se repite. */
  report: (message: string | null) => void
  dismiss: () => void
}

const StatusBannerContext = createContext<StatusBannerValue | null>(null)

export function StatusBannerProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<string | null>(null)
  const report = useCallback((message: string | null) => {
    setError((previous) => (previous === message ? previous : message))
  }, [])
  const dismiss = useCallback(() => setError(null), [])
  const value = useMemo(() => ({ error, report, dismiss }), [error, report, dismiss])

  return <StatusBannerContext.Provider value={value}>{children}</StatusBannerContext.Provider>
}

export function useStatusBanner(): StatusBannerValue {
  const value = useContext(StatusBannerContext)
  if (!value) throw new Error('useStatusBanner debe usarse dentro de StatusBannerProvider')
  return value
}

/** Banner compartido por todos los panes, colgado bajo la barra de título. */
export function StatusBanner() {
  const { error, dismiss } = useStatusBanner()
  if (!error) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-5 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-foreground"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <span className="sr-only">{tr('banner.error')}</span>
        <span className="break-words">{error}</span>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-3" aria-hidden="true" />
        {tr('banner.dismiss')}
      </button>
    </div>
  )
}
