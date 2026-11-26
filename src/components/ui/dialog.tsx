import type * as React from 'react'
import {
  Dialog as HeadlessDialog,
  DialogBackdrop,
  DialogDescription as HeadlessDescription,
  DialogPanel,
  DialogTitle as HeadlessTitle,
  useClose,
} from '@headlessui/react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  return (
    <HeadlessDialog open={open} onClose={() => onOpenChange(false)} className="relative z-50">
      {children}
    </HeadlessDialog>
  )
}

export function DialogContent({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  const close = useClose()
  return (
    <>
      <DialogBackdrop className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <DialogPanel
          className={cn(
            'relative w-full max-w-lg rounded-xl border bg-card p-6 text-card-foreground shadow-xl',
            className,
          )}
        >
          {children}
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar"
            className="absolute right-4 top-4 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" />
          </button>
        </DialogPanel>
      </div>
    </>
  )
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 text-left', className)} {...props} />
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex justify-end gap-2', className)} {...props} />
}

export const DialogTitle = HeadlessTitle
export const DialogDescription = HeadlessDescription
