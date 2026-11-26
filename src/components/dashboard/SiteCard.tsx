import { Folder, Globe2, Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SiteActionsMenu } from '@/components/sites/SiteActionsMenu'
import type { Site } from '@/lib/types'

interface SiteCardProps {
  site: Site
}

export function SiteCard({ site }: SiteCardProps) {
  const running = site.status !== 'stopped'
  const version = site.kind === 'php' ? site.phpVersion : site.nodeVersion

  return (
    <Card className="group transition-colors hover:border-ring/50">
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">{site.name}</h3>
            {site.tlsInternal && (
              <Badge variant="secondary" title="TLS interno">
                <Lock className="size-3" />
              </Badge>
            )}
          </div>
          <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <Globe2 className="size-3 shrink-0" />
            {site.domains.join(', ')}
          </p>
          <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <Folder className="size-3 shrink-0" />
            {site.root}
          </p>
        </div>
        <SiteActionsMenu site={site} />
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {site.kind}
          {version ? ` · v${version}` : ''}
        </span>
        <Badge variant={running ? 'success' : 'outline'}>
          <span
            className={`mr-1.5 size-1.5 rounded-full ${
              running ? 'bg-emerald-500' : 'bg-muted-foreground'
            }`}
          />
          {running ? 'Activo' : 'Detenido'}
        </Badge>
      </CardContent>
    </Card>
  )
}
