import { useEffect, useState } from 'react'
import type * as React from 'react'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tr } from '@/lib/i18n'
import { Sidebar } from './Sidebar'
import { StatusBanner, StatusBannerProvider } from './StatusBanner'
import { ContentScroll, ContentScrollProvider } from './ContentScroll'

interface AppShellProps {
  children: React.ReactNode
}

/** Breakpoint de `NavigationSplitView` en Flock: 560sp. */
const COMPACT_QUERY = '(max-width: 560px)'

export function AppShell({ children }: AppShellProps) {
  const [compact, setCompact] = useState(false)
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    const query = window.matchMedia(COMPACT_QUERY)
    const update = () => setCompact(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return (
    <StatusBannerProvider>
      <ContentScrollProvider>
        {/* El arrastre lo da el overlay nativo del título; el contenido recibe la rueda. */}
        <div className="flex h-screen overflow-hidden bg-background">
          <div className="flex min-h-0 w-full flex-1">
            <Sidebar
              compact={compact}
              showContent={showContent}
              onNavigate={() => setShowContent(true)}
            />
            <main
              className={cn('min-h-0 min-w-0 flex-1 overflow-hidden', compact && !showContent && 'hidden')}
            >
              {compact ? (
                <div className="flex items-center border-b px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setShowContent(false)}
                    className="window-no-drag inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                    {tr('pane.back')}
                  </button>
                </div>
              ) : null}
              <ContentScroll>
                {/* 36 px de overlay nativo + 4 px de aire para que ningún pane quede debajo. */}
                <div className="mx-auto w-full max-w-6xl px-3 pb-8 pt-10 sm:px-6 lg:px-8">
                  <StatusBanner />
                  {children}
                </div>
              </ContentScroll>
            </main>
          </div>
        </div>
      </ContentScrollProvider>
    </StatusBannerProvider>
  )
}
