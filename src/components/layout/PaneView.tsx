import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { useContentScrollRef } from './ContentScroll'

interface PaneViewProps {
  /** Descripción fija sobre los grupos, equivalente al `description` de `PaneView`. */
  description?: string
  /** Cambia cuando el contenido se regenera; permite conservar la posición de scroll. */
  groupsKey?: string | number
  children: ReactNode
  className?: string
}

/** Columna de los panes: ancho máximo 680px y mismo ritmo vertical que `PaneView` en Flock. */
export function PaneView({ description, groupsKey, children, className }: PaneViewProps) {
  const scrollRef = useContentScrollRef()
  const position = useRef(0)

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    const remember = () => {
      position.current = node.scrollTop
    }
    node.addEventListener('scroll', remember, { passive: true })
    return () => node.removeEventListener('scroll', remember)
  }, [scrollRef])

  useEffect(() => {
    const saved = position.current
    const frame = requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = saved
    })
    return () => cancelAnimationFrame(frame)
  }, [groupsKey, scrollRef])

  return (
    <div className={cn('mx-auto w-full max-w-[680px] pb-6', className)}>
      {description ? (
        <>
          <p className="text-left text-sm leading-relaxed text-muted-foreground">{description}</p>
          <Separator className="my-5" />
        </>
      ) : null}
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  )
}
