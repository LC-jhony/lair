import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  label: string
  disabled?: boolean
  className?: string
}

/** Select del mismo tamaño y jerarquía que los de la ventana Sites de Flock. */
export function Select({ value, onChange, options, label, disabled = false, className }: SelectProps) {
  const selected = options.find((option) => option.value === value)

  return (
    <Listbox value={value} onChange={onChange} disabled={disabled}>
      <div className={cn('relative inline-block text-left', className)}>
        <ListboxButton
          aria-label={label}
          className={cn(
            'inline-flex h-9 min-w-44 items-center justify-between gap-3 rounded-md border bg-background px-3 text-sm shadow-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <span className="truncate">{selected?.label ?? value}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </ListboxButton>
        <ListboxOptions
          anchor="bottom start"
          className="z-50 mt-1 max-h-64 min-w-44 overflow-auto rounded-md border bg-popover p-1 text-sm shadow-lg [--anchor-gap:4px]"
        >
          {options.map((option) => (
            <ListboxOption
              key={option.value}
              value={option.value}
              className="flex cursor-pointer items-center justify-between gap-4 rounded px-2 py-1.5 data-focus:bg-accent data-selected:font-medium"
            >
              <span>{option.label}</span>
              {option.value === value ? <Check className="size-4 text-primary" aria-hidden="true" /> : null}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  )
}
