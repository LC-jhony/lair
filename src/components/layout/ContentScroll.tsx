import { createContext, useContext, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'

const ContentScrollContext = createContext<RefObject<HTMLDivElement | null> | null>(null)

/**
 * El contenedor de scroll del contenido. Los panes pueden conservar su posición cuando
 * sustituyen sus grupos, igual que `PaneView::set_groups` conserva el `GtkAdjustment`.
 */
export function ContentScrollProvider({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  return <ContentScrollContext.Provider value={ref}>{children}</ContentScrollContext.Provider>
}

export function useContentScrollRef(): RefObject<HTMLDivElement | null> {
  const ref = useContext(ContentScrollContext)
  if (!ref) throw new Error('useContentScrollRef debe usarse dentro de ContentScrollProvider')
  return ref
}

/** Contenedor de scroll del contenido; `PaneView` lee su posición para conservarla. */
export function ContentScroll({ children }: { children: ReactNode }) {
  const ref = useContentScrollRef()
  return (
    <div ref={ref} className="h-full overflow-y-auto">
      {children}
    </div>
  )
}
