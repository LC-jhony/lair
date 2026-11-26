import type * as React from 'react'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { cn } from '@/lib/utils'

export const DropdownMenu = Menu
export const DropdownMenuTrigger = MenuButton

interface DropdownMenuContentProps {
  children: React.ReactNode
  className?: string
  align?: 'start' | 'end'
}

export function DropdownMenuContent({
  children,
  className,
  align = 'start',
}: DropdownMenuContentProps) {
  return (
    <MenuItems
      anchor={align === 'end' ? 'bottom end' : 'bottom start'}
      className={cn(
        'z-50 min-w-40 rounded-md border bg-popover p-1 text-popover-foreground shadow-lg outline-none',
        className,
      )}
    >
      {children}
    </MenuItems>
  )
}

interface DropdownMenuItemProps {
  children: React.ReactNode
  className?: string
  disabled?: boolean
  onClick?: () => void
}

export function DropdownMenuItem({
  children,
  className,
  disabled,
  onClick,
}: DropdownMenuItemProps) {
  return (
    <MenuItem disabled={disabled}>
      {({ active, disabled: itemDisabled }) => (
        <button
          type="button"
          onClick={onClick}
          disabled={itemDisabled}
          className={cn(
            'flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors',
            active && 'bg-accent text-accent-foreground',
            itemDisabled && 'pointer-events-none opacity-50',
            className,
          )}
        >
          {children}
        </button>
      )}
    </MenuItem>
  )
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div className={cn('-mx-1 my-1 h-px bg-border', className)} />
}

export function DropdownMenuLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-2 py-1.5 text-xs font-semibold text-muted-foreground', className)} {...props} />
}
