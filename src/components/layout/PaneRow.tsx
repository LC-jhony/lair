import type { ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

/** Equivalente a `adw::PreferencesGroup`: título, filas y nota al pie. */
export function Group({
  title,
  footer,
  children,
  className,
}: {
  title?: string
  footer?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('overflow-hidden rounded-xl border bg-card shadow-sm', className)}>
      {title ? (
        <h3 className="border-b px-4 py-3 text-sm font-semibold tracking-tight">{title}</h3>
      ) : null}
      <div className="divide-y divide-border">{children}</div>
      {footer ? (
        <p className="border-t px-4 py-3 text-xs leading-relaxed text-muted-foreground">{footer}</p>
      ) : null}
    </section>
  )
}

/** `info_row`: etiqueta a la izquierda y valor seleccionable a la derecha. */
export function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 px-4 py-2">
      <span className="shrink-0 text-sm">{label}</span>
      <span
        className={cn(
          'min-w-0 truncate text-right text-sm text-muted-foreground selection:bg-primary selection:text-primary-foreground',
          mono && 'font-mono text-xs',
        )}
        title={value}
      >
        {value}
      </span>
    </div>
  )
}

/** `open_row`: valor + botón que abre una ventana o ejecuta una acción. */
export function OpenRow({
  label,
  value,
  action,
  onAction,
}: {
  label: string
  value: string
  action: string
  onAction: () => void
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 px-4 py-2">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        <p className="truncate text-xs text-muted-foreground" title={value}>
          {value}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onAction} className="shrink-0">
        {action}
        <ArrowUpRight className="size-3" aria-hidden="true" />
      </Button>
    </div>
  )
}

/** `switch_row`: título, subtítulo opcional e interruptor. */
export function SwitchRow({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 px-4 py-2">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} label={label} />
    </div>
  )
}

export type DotState = 'running' | 'starting' | 'stopping' | 'failed' | 'idle'

/** `state_dot`: verde/ámbar/rojo/gris, con texto para lectores de pantalla. */
export function StateDot({ state, label }: { state: DotState; label?: string }) {
  const color: Record<DotState, string> = {
    running: 'text-emerald-500',
    starting: 'text-amber-500',
    stopping: 'text-amber-500',
    failed: 'text-destructive',
    idle: 'text-muted-foreground',
  }
  return (
    <span className="inline-flex items-center gap-2" title={label ?? state}>
      <span className={cn('text-lg leading-none', color[state])} aria-hidden="true">
        ●
      </span>
      <span className="sr-only">{label ?? state}</span>
    </span>
  )
}

/** `code_block`: texto monoespacio seleccionable dentro de un marco. */
export function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="mx-4 my-3 select-text overflow-x-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
      {children}
    </pre>
  )
}
