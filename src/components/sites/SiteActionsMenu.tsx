import { ExternalLink, MoreHorizontal, RefreshCw, Trash2 } from 'lucide-react'
import {
  useHostsStatus,
  useReloadCaddy,
  useRemoveSite,
  useSiteEnvironment,
} from '@/hooks/useSites'
import { ipc } from '@/lib/ipc'
import { browserUrl } from '@/lib/site-url'
import type { Site } from '@/lib/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface SiteActionsMenuProps {
  site: Site
}

export function SiteActionsMenu({ site }: SiteActionsMenuProps) {
  const remove = useRemoveSite()
  const reload = useReloadCaddy()
  const domain = site.domains[0] ?? `${site.name}.test`
  const environment = useSiteEnvironment(domain)
  const hosts = useHostsStatus()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Acciones para ${site.name}`}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => {
            const alias = `${site.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}.localhost`
            const host = environment.data?.dns.ok ? domain : alias
            void ipc.openSite(browserUrl(host, site.tlsInternal === true, hosts.data?.privileged === true))
          }}
        >
          <ExternalLink className="size-4" />
          Abrir sitio
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={reload.isPending}
          onClick={() => reload.mutate([site])}
        >
          <RefreshCw className="size-4" />
          Recargar Caddy
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          disabled={remove.isPending}
          onClick={() => remove.mutate(site.id)}
        >
          <Trash2 className="size-4" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
