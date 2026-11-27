import { Bird, LayoutDashboard, RotateCcw } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useOnboarding } from '@/hooks/useOnboarding'
import { cn } from '@/lib/utils'
import { tr } from '@/lib/i18n'
import { badgeVariants } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { PANES } from '@/components/panes/panes'
import { ThemeSelect } from './ThemeSelect'

interface SidebarProps {
  /** Modo < 560px: la sidebar y el pane se turnan, como `NavigationSplitView` colapsado. */
  compact: boolean
  /** En modo compacto, el pane está visible y la sidebar se oculta. */
  showContent: boolean
  onNavigate: () => void
}

const linkClass = (active: boolean) =>
  cn(
    buttonVariants({ variant: active ? 'secondary' : 'ghost', size: 'sm' }),
    'w-full justify-start gap-3 px-3',
  )

export function Sidebar({ compact, showContent, onNavigate }: SidebarProps) {
  const { reset } = useOnboarding()

  return (
    <aside
      className={cn(
        'flex w-56 shrink-0 flex-col border-r bg-card/40 px-3 py-4',
        compact && 'w-full',
        compact && showContent && 'hidden',
      )}
    >
      <div className="window-drag mb-4 flex items-center gap-2 px-1 py-1">
        <Bird className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <span className="flex-1 truncate text-xs font-semibold uppercase tracking-wide">
          {tr('app.name')}
        </span>
        <span className={cn(badgeVariants({ variant: 'outline' }), 'px-1.5 py-0 text-[10px]')}>
          {tr('app.version')}
        </span>
      </div>

      <nav aria-label={tr('settings.pane.general')} className="flex flex-col gap-1">
        {PANES.map(({ id, titleKey, icon: Icon }) => (
          <NavLink
            key={id}
            to={`/${id}`}
            onClick={onNavigate}
            className={({ isActive }) => linkClass(isActive)}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {tr(titleKey)}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-2">
        <NavLink to="/" end onClick={onNavigate} className={({ isActive }) => linkClass(isActive)}>
          <LayoutDashboard className="size-4 shrink-0" aria-hidden="true" />
          Dashboard
        </NavLink>
        <button type="button" onClick={() => reset.mutate()} className={linkClass(false)} title="Repetir configuración inicial">
          <RotateCcw className="size-4 shrink-0" aria-hidden="true" />
          Reset onboarding
        </button>
        <Separator className="my-2" />
        <ThemeSelect />
      </div>
    </aside>
  )
}
