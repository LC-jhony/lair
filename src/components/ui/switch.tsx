import * as React from 'react'
import { Switch as HeadlessSwitch } from '@headlessui/react'
import { cn } from '@/lib/utils'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label: string
  className?: string
}

/** Interruptor con la misma semántica visual que los `SwitchRow` de Flock. */
export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onChange, disabled = false, label, className }, ref) => (
    <HeadlessSwitch
      ref={ref}
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-muted-foreground/30',
        className,
      )}
    >
      <span
        className={cn(
          'pointer-events-none block size-4 rounded-full bg-background shadow-sm transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </HeadlessSwitch>
  ),
)
Switch.displayName = 'Switch'
