import type { ReactNode } from 'react'
import {
  Checkbox as HeadlessCheckbox,
  Description as HeadlessDescription,
  Field as HeadlessField,
  Label as HeadlessLabel,
} from '@headlessui/react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Field({ children, className }: { children: ReactNode; className?: string }) {
  return <HeadlessField className={cn('space-y-1.5', className)}>{children}</HeadlessField>
}

export function Label({ children, className, htmlFor }: { children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <HeadlessLabel htmlFor={htmlFor} className={cn('block text-sm font-medium', className)}>
      {children}
    </HeadlessLabel>
  )
}

export function Description({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <HeadlessDescription className={cn('text-xs text-muted-foreground', className)}>
      {children}
    </HeadlessDescription>
  )
}

/** Checkbox de Headless UI con estado visual explícito y etiqueta asociada por `Field`. */
export function CheckboxField({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <Field>
      <div className="flex items-center gap-2">
        <HeadlessCheckbox
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className={({ checked: active }) =>
            cn(
              'flex size-4 shrink-0 cursor-pointer items-center justify-center rounded border transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:cursor-not-allowed disabled:opacity-50',
              active ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background',
            )
          }
        >
          {({ checked: active }) => (
            <span aria-hidden="true">{active ? <Check className="size-3" /> : null}</span>
          )}
        </HeadlessCheckbox>
        <Label className="cursor-pointer text-sm font-normal text-muted-foreground">{label}</Label>
      </div>
    </Field>
  )
}
