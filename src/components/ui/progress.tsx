import { cn } from '@/lib/utils'

interface ProgressProps {
  value?: number
  className?: string
}

export function Progress({ value = 0, className }: ProgressProps) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-secondary', className)}
    >
      <div
        className="size-full rounded-full bg-primary transition-transform"
        style={{ transform: `translateX(-${100 - Math.min(100, Math.max(0, value))}%)` }}
      />
    </div>
  )
}
