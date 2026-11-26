import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react'
import { Check, ChevronDown, Download, Star, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  useBinaries,
  useInstallComposer,
  useInstallVersion,
  useSetDefaultVersion,
  useUninstallVersion,
  useVersions,
} from '@/hooks/useBinaries'
import { cn } from '@/lib/utils'
import { compareVersions, groupByMinor } from '@/lib/versions'

interface VersionCatalogProps {
  packages: string[]
}

const TITLES: Record<string, string> = {
  php: 'PHP-FPM',
  frankenphp: 'FrankenPHP',
  node: 'Node.js',
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
  mariadb: 'MariaDB',
  mongodb: 'MongoDB',
  valkey: 'Valkey',
  redis: 'Redis',
  meilisearch: 'Meilisearch',
  typesense: 'Typesense',
  rustfs: 'RustFS',
  cloudflared: 'Cloudflared',
}

function labelFor(packageName: string, minor: string): string {
  if (packageName === 'php') return `PHP ${minor}`
  if (packageName === 'frankenphp') return `FrankenPHP ${minor}`
  if (packageName === 'node') return `Node ${minor}`
  return `v${minor}`
}

/** Catálogo por línea de versión, con los parches agrupados y ocultos tras un desplegable. */
export function VersionCatalog({ packages }: VersionCatalogProps) {
  const { data: versions = [], isLoading } = useVersions()
  const { data: installed = [] } = useBinaries()
  const install = useInstallVersion()
  const setDefault = useSetDefaultVersion()
  const uninstall = useUninstallVersion()
  const composer = useInstallComposer()

  const busy = install.isPending || setDefault.isPending || uninstall.isPending

  return (
    <div className="space-y-4">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando versiones disponibles…</p>
      ) : null}
      {!isLoading && versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay versiones publicadas para esta plataforma.
        </p>
      ) : null}

      {packages.map((name) => {
        const groups = groupByMinor(versions.filter((item) => item.package === name))
        if (groups.length === 0) return null
        return (
          <Card key={name}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base font-semibold">{TITLES[name] ?? name}</CardTitle>
              <Badge variant="secondary">{groups.length} líneas</Badge>
            </CardHeader>
            <CardContent className="space-y-1">
              {groups.map((group) => {
                const installedHere = installed.filter(
                  (item) =>
                    item.package === name &&
                    group.patches.some((patch) => patch.version === item.version),
                )
                const active = installedHere.find((item) => item.isDefault) ?? installedHere[0]
                const newer = active
                  ? group.patches.find(
                      (patch) =>
                        !patch.yanked && compareVersions(patch.version, active.version) > 0,
                    )
                  : undefined

                return (
                  <Disclosure key={`${name}-${group.minor}`} as="div" className="rounded-md">
                    <div className="flex items-center justify-between gap-3 px-2 py-2 even:bg-muted/40">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">
                            {labelFor(name, group.minor)}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {active?.version ?? group.latest.version}
                          </span>
                          {group.latest.lts ? <Badge variant="success">LTS</Badge> : null}
                          {group.latest.prerelease ? <Badge variant="warning">beta</Badge> : null}
                          {group.latest.yanked ? <Badge variant="warning">yanked</Badge> : null}
                          {active?.isDefault && active.installed ? (
                            <Badge variant="default">predeterminada</Badge>
                          ) : null}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {group.patches.length} parche{group.patches.length === 1 ? '' : 's'} ·
                          publicado {group.latest.published.slice(0, 10)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {installedHere.length === 0 ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy || group.latest.yanked}
                            onClick={() =>
                              install.mutate({ package: name, version: group.latest.version })
                            }
                          >
                            <Download className="size-3" />
                            Instalar
                          </Button>
                        ) : (
                          <>
                            {newer ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() =>
                                  install.mutate({ package: name, version: newer.version })
                                }
                              >
                                <Download className="size-3" />
                                Actualizar
                              </Button>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Check className="size-3" /> Al día
                              </span>
                            )}
                            {!active.isDefault ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() =>
                                  setDefault.mutate({ package: name, version: active.version })
                                }
                              >
                                <Star className="size-3" />
                                Usar
                              </Button>
                            ) : null}
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Desinstalar ${labelFor(name, group.minor)}`}
                              disabled={busy}
                              onClick={async () => {
                                for (const item of installedHere) {
                                  await uninstall.mutateAsync({
                                    package: name,
                                    version: item.version,
                                  })
                                }
                              }}
                            >
                              <Trash2 className="size-3.5 text-destructive" />
                            </Button>
                          </>
                        )}
                        <DisclosureButton
                          className={cn(
                            'group inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground',
                            'hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          )}
                        >
                          Parches
                          <ChevronDown className="size-3 group-data-open:rotate-180" aria-hidden="true" />
                        </DisclosureButton>
                      </div>
                    </div>
                    <DisclosurePanel className="space-y-1 border-t px-4 py-2 text-xs">
                      {group.patches.map((patch) => {
                        const isInstalled = installedHere.some(
                          (item) => item.version === patch.version,
                        )
                        return (
                          <div
                            key={`${patch.version}-${patch.build}`}
                            className="flex items-center justify-between gap-3 py-1"
                          >
                            <span className="font-mono text-muted-foreground">
                              v{patch.version} · build {patch.build} · {patch.published.slice(0, 10)}
                            </span>
                            {isInstalled ? (
                              <span className="text-muted-foreground">instalado</span>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busy || patch.yanked}
                                onClick={() =>
                                  install.mutate({ package: name, version: patch.version })
                                }
                              >
                                Instalar
                              </Button>
                            )}
                          </div>
                        )
                      })}
                    </DisclosurePanel>
                  </Disclosure>
                )
              })}
            </CardContent>
          </Card>
        )
      })}

      {packages.includes('composer') ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Composer</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Se descarga de getcomposer.org y se verifica con su SHA-256 publicado.
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={composer.isPending}
              onClick={() => composer.mutate()}
            >
              <Download className="size-3" />
              Instalar
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {(install.isError || setDefault.isError || uninstall.isError || composer.isError) && (
        <p className="text-sm text-destructive" role="alert">
          {(install.error ?? setDefault.error ?? uninstall.error ?? composer.error)?.message}
        </p>
      )}
    </div>
  )
}
