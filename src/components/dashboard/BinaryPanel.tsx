import { ServerCog } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { VersionCatalog } from '@/components/binaries/VersionCatalog'
import { useCaddyStatus } from '@/hooks/useBinaries'

const PACKAGES = [
  'php',
  'node',
  'frankenphp',
  'composer',
  'postgres',
  'mysql',
  'mariadb',
  'valkey',
  'redis',
  'meilisearch',
  'typesense',
  'rustfs',
  'cloudflared',
]

export function BinaryPanel() {
  const { data: caddy } = useCaddyStatus()

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Binarios y servicios</h2>
        <p className="text-sm text-muted-foreground">
          Versiones publicadas en el manifiesto firmado de Flock (canal estable).
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ServerCog className="size-4" />
            Caddy
          </CardTitle>
          <Badge variant={caddy?.running ? 'success' : 'outline'}>
            {caddy?.running ? 'En ejecución' : 'No instalado'}
          </Badge>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {caddy?.version ? `v${caddy.version}` : 'Reverse proxy local con HTTPS automático.'}
          {caddy?.configPath && <p className="mt-1 truncate text-xs">{caddy.configPath}</p>}
        </CardContent>
      </Card>

      <VersionCatalog packages={PACKAGES} />
    </section>
  )
}
