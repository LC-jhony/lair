import { cn } from '@/lib/utils'

export type ProgressTone = 'low' | 'medium' | 'high'

interface ProgressProps {
  value?: number
  className?: string
  /** Fuerza un tono; si no se da, se elige por el porcentaje. */
  tone?: ProgressTone
  showLabel?: boolean
}

const TONES: Record<ProgressTone, { bar: string; text: string; label: string }> = {
  low: { bar: 'bg-amber-500', text: 'text-amber-500', label: 'Iniciando' },
  medium: { bar: 'bg-sky-500', text: 'text-sky-500', label: 'En curso' },
  high: { bar: 'bg-emerald-500', text: 'text-emerald-500', label: 'Casi listo' },
}

function toneFor(value: number): ProgressTone {
  if (value < 34) return 'low'
  if (value < 70) return 'medium'
  return 'high'
}

/** Barra con tres estados visuales: ámbar (inicio), azul (en curso) y verde (final). */
export function Progress({ value = 0, className, tone, showLabel = false }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value))
  const selected = TONES[tone ?? toneFor(clamped)]
  const label = clamped === 100 ? 'Completado' : selected.label

  return (
    <div className={cn('space-y-1.5', className)}>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${clamped}% · ${label}`}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-300 ease-out',
            selected.bar,
            clamped === 0 && 'w-0',
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel ? (
        <div className="flex justify-between text-[11px] font-medium">
          <span className={selected.text}>{label}</span>
          <span className="text-muted-foreground tabular-nums">{clamped}%</span>
        </div>
      ) : null}
    </div>
  )
}

export { TONES as PROGRESS_TONES }
