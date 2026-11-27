import * as React from 'react'
import { Button as HeadlessButton } from '@headlessui/react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Convenciones de shadcn/ui (variantes, tamaños, iconos y foco). */
const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium',
    'transition-all duration-150 ease-out active:translate-y-px active:scale-[0.98]',
    'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    "[&_[data-icon='inline-start']]:-ml-1 [&_[data-icon='inline-end']]:-mr-1",
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'bg-blue-600 text-white shadow-sm hover:bg-blue-700 hover:shadow active:bg-blue-800',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/70 active:bg-secondary/50',
        outline:
          'border border-border bg-background text-foreground shadow-sm hover:border-ring/60 hover:bg-accent/60 active:bg-accent',
        ghost: 'text-muted-foreground hover:bg-accent hover:text-foreground active:bg-accent/70',
        destructive:
          'bg-destructive text-white shadow-sm hover:bg-destructive/85 active:bg-destructive/70',
        link: 'text-primary underline-offset-4 hover:underline active:text-primary/70',
      },
      size: {
        xs: 'h-6 rounded px-2 text-xs',
        sm: 'h-8 rounded-md px-3 text-xs',
        default: 'h-9 px-4 py-2',
        lg: 'h-10 rounded-md px-6',
        icon: 'size-9',
        'icon-xs': 'size-6 rounded',
        'icon-sm': 'size-8 rounded-md',
        'icon-lg': 'size-10 rounded-md',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading = false, disabled, children, ...props }, ref) => (
    <HeadlessButton
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden="true" /> : null}
      {children}
    </HeadlessButton>
  ),
)
Button.displayName = 'Button'

export { buttonVariants }
