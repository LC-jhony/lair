import { Check, Monitor, Moon, Sun } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import { cn } from '@/lib/utils'
import { tr } from '@/lib/i18n'
import type { ThemeMode } from '@/lib/theme'
import { useTheme } from './ThemeProvider'

const OPTIONS: Array<{ value: ThemeMode; label: string; icon: LucideIcon }> = [
  { value: 'light', label: 'theme.light', icon: Sun },
  { value: 'dark', label: 'theme.dark', icon: Moon },
  { value: 'system', label: 'theme.system', icon: Monitor },
]

/** Selector de tema construido con Headless UI Listbox. */
export function ThemeSelect() {
  const { mode, setMode } = useTheme()
  const selected = OPTIONS.find((option) => option.value === mode) ?? OPTIONS[2]
  const Icon = selected.icon

  return (
    <Listbox value={mode} onChange={setMode}>
      <div className="relative">
        <ListboxButton
          aria-label={tr('theme.label')}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors',
            'hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{tr(selected.label)}</span>
        </ListboxButton>
        <ListboxOptions
          anchor="bottom start"
          className="z-50 mt-1 min-w-40 rounded-md border bg-popover p-1 text-xs shadow-lg [--anchor-gap:4px]"
        >
          {OPTIONS.map(({ value, label, icon: OptionIcon }) => (
            <ListboxOption
              key={value}
              value={value}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 data-focus:bg-accent data-selected:font-medium"
            >
              <OptionIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="flex-1">{tr(label)}</span>
              {value === mode ? <Check className="size-3.5 text-primary" aria-hidden="true" /> : null}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  )
}
