import { useState } from 'react'
import { ServerCog, Settings2, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { VersionCatalog } from '@/components/binaries/VersionCatalog'
import {
  useCaStatus,
  useCaddyStatus,
  useEnsurePath,
  useGlobalOptions,
  usePathStatus,
  useRemovePath,
  useSetGlobalOptions,
  useTrustCa,
  useVerifyBinaries,
} from '@/hooks/useBinaries'

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
  const { data: ca } = useCaStatus()
  const trust = useTrustCa()
  const { data: globals } = useGlobalOptions()
  const saveGlobals = useSetGlobalOptions()
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [options, setOptions] = useState('')
  const { data: path } = usePathStatus()
  const ensurePath = useEnsurePath()
  const removePath = useRemovePath()
  const verify = useVerifyBinaries()

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
          <Badge variant={caddy?.running ? 'success' : caddy?.installed ? 'warning' : 'outline'}>
            {caddy?.running ? 'En ejecución' : caddy?.installed ? 'Instalado · detenido' : 'No instalado'}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{caddy?.version ? `v${caddy.version}` : 'Reverse proxy local con HTTPS automático.'}</p>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4" />
              CA local: {ca?.available ? 'disponible' : 'no disponible'}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={trust.isPending}
              onClick={() => trust.mutate()}
            >
              Instalar CA
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Opciones globales del Caddyfile</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setOptions(globals?.options ?? '')
                setOptionsOpen(true)
              }}
            >
              <Settings2 className="size-3" />
              Editar
            </Button>
          </div>
          {caddy?.configPath && <p className="truncate text-xs">{caddy.configPath}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">PATH del sistema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-mono text-xs text-muted-foreground">{path?.dir}</p>
              <p className="text-xs text-muted-foreground">
                {path?.ok ? 'Configurado en tus shells' : 'Pendiente: abre una terminal nueva tras añadirlo'}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={ensurePath.isPending}
                onClick={() => ensurePath.mutate()}
              >
                Añadir al PATH
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={removePath.isPending || !path?.ok}
                onClick={() => removePath.mutate()}
              >
                Quitar
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t pt-3">
            <span className="text-xs text-muted-foreground">
              Verifica que los shims responden en una terminal nueva.
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={verify.isPending}
              onClick={() => verify.mutate()}
            >
              Verificar binarios
            </Button>
          </div>
          {verify.data?.results?.length ? (
            <ul className="space-y-1 text-xs">
              {verify.data.results.map((item) => (
                <li key={item.package} className="flex justify-between">
                  <span>{item.package}</span>
                  <span className={item.ok ? 'text-emerald-500' : 'text-destructive'}>
                    {item.ok ? item.version : 'no disponible'}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={optionsOpen} onOpenChange={setOptionsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Opciones globales de Caddy</DialogTitle>
            <DialogDescription>
              Se anteponen al Caddyfile generado. Ejemplo: <code>{'{'}</code> debug {'}'}.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={options}
            onChange={(event) => setOptions(event.target.value)}
            rows={8}
            spellCheck={false}
            className="w-full rounded-md border border-input bg-background p-3 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOptionsOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={saveGlobals.isPending}
              onClick={() => {
                saveGlobals.mutate(options)
                setOptionsOpen(false)
              }}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VersionCatalog packages={PACKAGES} />
    </section>
  )
}
