import { useState } from 'react'
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react'
import {
  ChevronDown,
  ExternalLink,
  FolderPlus,
  GitBranch,
  Globe2,
  Lock,
  Play,
  Plus,
  RefreshCw,
  Square,
  Terminal,
  Trash2,
  Unplug,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { PaneView, StateDot, useStatusBanner } from '@/components/layout'
import { useStartCaddy, useStopCaddy } from '@/hooks/useBinaries'
import { Separator } from '@/components/ui/separator'
import { useCaddyStatus, useVersions } from '@/hooks/useBinaries'
import {
  useAddWorktree,
  useCreateSite,
  useParked,
  useParkFolder,
  useRemoveSite,
  useRemoveWorktree,
  useSiteEnvironment,
  useSites,
  useUnparkFolder,
  useUpdateSite,
  useWorktrees,
  useReloadCaddy,
} from '@/hooks/useSites'
import { ipc } from '@/lib/ipc'
import { tr } from '@/lib/i18n'
import { groupByMinor } from '@/lib/versions'
import { browserUrl } from '@/lib/site-url'
import type { ParkedProject, Site } from '@/lib/types'
import { NewSiteDialog } from './NewSiteDialog'

type VersionOption = { value: string; label: string }

function SiteSettingsCard({
  site,
  phpOptions,
  nodeOptions,
}: {
  site: Site
  phpOptions: VersionOption[]
  nodeOptions: VersionOption[]
}) {
  const update = useUpdateSite()
  const remove = useRemoveSite()
  const reload = useReloadCaddy()
  const worktrees = useWorktrees(site.root)
  const addWorktree = useAddWorktree()
  const removeWorktree = useRemoveWorktree()
  const [branch, setBranch] = useState('')

  const domain = site.domains[0] ?? `${site.name}.test`
  const url = browserUrl(site.tlsInternal === true)
  const phpVersion = site.phpVersion ?? phpOptions[0]?.value ?? '8.5'
  const nodeVersion = site.nodeVersion ?? nodeOptions[0]?.value ?? '24'

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{site.name}</h3>
            {site.tlsInternal ? (
              <Badge variant="secondary">
                <Lock className="size-3" /> HTTPS
              </Badge>
            ) : null}
            <Badge variant="outline">{site.kind}</Badge>
          </div>
          <button
            type="button"
            onClick={() => void ipc.openSite(url)}
            className="flex items-center gap-1.5 truncate text-xs text-primary hover:underline"
          >
            <Globe2 className="size-3 shrink-0" />
            {domain}
          </button>
          <p className="truncate font-mono text-xs text-muted-foreground">{site.root}</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Eliminar ${site.name}`}
          disabled={remove.isPending}
          onClick={() => remove.mutate(site.id)}
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <span className="text-sm">HTTPS / certificado local</span>
            <Switch
              checked={site.tlsInternal}
              onChange={(checked) => update.mutate({ id: site.id, tlsInternal: checked })}
              label={`HTTPS para ${site.name}`}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <span className="text-sm">Versión de PHP</span>
            <Select
              label={`PHP de ${site.name}`}
              value={phpVersion}
              onChange={(value) => update.mutate({ id: site.id, phpVersion: value })}
              options={phpOptions}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 sm:col-span-2">
            <span className="text-sm">Versión de Node.js</span>
            <Select
              label={`Node de ${site.name}`}
              value={nodeVersion}
              onChange={(value) => update.mutate({ id: site.id, nodeVersion: value })}
              options={nodeOptions}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => void ipc.openSite(url)}>
            <ExternalLink className="size-3.5" /> Abrir
          </Button>
          <Button size="sm" variant="outline" onClick={() => void ipc.openInEditor(site.root)}>
            <GitBranch className="size-3.5" /> Editor
          </Button>
          <Button size="sm" variant="outline" onClick={() => void ipc.openTerminal(site.root)}>
            <Terminal className="size-3.5" /> Terminal
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={reload.isPending}
            onClick={() => reload.mutate([site])}
          >
            <RefreshCw className="size-3.5" /> Recargar Caddy
          </Button>
        </div>

        <Disclosure>
          <DisclosureButton className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <GitBranch className="size-4" />
            Workspaces ({worktrees.data?.length ?? 0})
            <ChevronDown className="size-3 group-data-open:rotate-180" />
          </DisclosureButton>
          <DisclosurePanel className="mt-3 space-y-2 border-t pt-3">
            {worktrees.data?.map((worktree) => (
              <div
                key={worktree.path}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{worktree.name}</p>
                  <p className="truncate font-mono text-muted-foreground">
                    {worktree.branch || 'detached'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void ipc.openInEditor(worktree.path)}
                  >
                    Abrir
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Eliminar worktree ${worktree.name}`}
                    disabled={removeWorktree.isPending}
                    onClick={() =>
                      removeWorktree.mutate({ root: site.root, path: worktree.path })
                    }
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Input
                value={branch}
                placeholder="nombre-del-branch"
                onChange={(event) => setBranch(event.target.value)}
                className="h-8"
              />
              <Button
                size="sm"
                disabled={!branch.trim() || addWorktree.isPending}
                onClick={() => {
                  addWorktree.mutate({ root: site.root, branch: branch.trim() })
                  setBranch('')
                }}
              >
                <Plus className="size-3" /> Nuevo
              </Button>
            </div>
          </DisclosurePanel>
        </Disclosure>
      </CardContent>
    </Card>
  )
}

/** Pestaña Sites: sitios vinculados, proyectos detectados y acciones por proyecto. */
export function SitesPane() {
  const { data: sites = [], isLoading } = useSites()
  const { data: parked = [] } = useParked()
  const { data: versions = [] } = useVersions('php')
  const { data: nodeVersions = [] } = useVersions('node')
  const { data: caddy } = useCaddyStatus()
  const startCaddy = useStartCaddy()
  const stopCaddy = useStopCaddy()
  const banner = useStatusBanner()
  const { data: environment } = useSiteEnvironment(
    sites[0]?.domains[0] ?? `${sites[0]?.name ?? 'acme'}.test`,
  )
  const create = useCreateSite()
  const park = useParkFolder()
  const unpark = useUnparkFolder()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [parkOpen, setParkOpen] = useState(false)
  const [folder, setFolder] = useState('')

  const phpOptions = groupByMinor(versions)
    .filter((group) => group.package === 'php')
    .map((group) => ({ value: group.latest.version, label: group.minor }))
  const defaultPhp = phpOptions[0]?.value ?? '8.5'
  const nodeOptions = groupByMinor(nodeVersions)
    .filter((group) => group.package === 'node')
    .map((group) => ({ value: group.latest.version, label: group.minor }))

  const toggleCaddy = async () => {
    try {
      const result = caddy?.running
        ? await stopCaddy.mutateAsync()
        : await startCaddy.mutateAsync()
      banner.notify(String((result as { detail?: string }).detail ?? 'Caddy detenido'))
    } catch (failure) {
      banner.report((failure as Error).message)
    }
  }

  const link = (project: ParkedProject) =>
    create.mutate({
      name: project.name,
      root: project.root,
      kind: project.kind,
      domains: [project.domain],
      phpVersion: project.kind === 'php' ? defaultPhp : undefined,
      tlsInternal: true,
    })

  return (
    <PaneView description={tr('sites.subtitle')} groupsKey="sites">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="size-3.5" /> Nuevo sitio
          </Button>
          <Button size="sm" variant="outline" onClick={() => setParkOpen(true)}>
            <FolderPlus className="size-3.5" /> Añadir carpeta
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <StateDot state={caddy?.running ? 'running' : 'idle'} />
            Caddy {caddy?.running ? `v${caddy.version ?? ''}` : 'detenido'}
          </span>
          <span>DNS .test: {environment?.dns.ok ? 'OK' : 'no resuelve'}</span>
          <span>
            Puertos 80/443:{' '}
            {environment?.ports.http || environment?.ports.https ? 'activos' : 'cerrados'}
          </span>
          <Button
            size="xs"
            variant="outline"
            loading={startCaddy.isPending || stopCaddy.isPending}
            onClick={() => void toggleCaddy()}
          >
            {caddy?.running ? <Square className="size-3" /> : <Play className="size-3" />}
            {caddy?.running ? 'Detener Caddy' : 'Iniciar Caddy'}
          </Button>
        </div>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Cargando sitios…</p> : null}

      {parked.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Proyectos detectados</h3>
          {parked.map((project) => (
            <div
              key={project.root}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{project.name}</p>
                <p className="truncate text-xs text-muted-foreground">{project.domain}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" disabled={create.isPending} onClick={() => link(project)}>
                  Vincular
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Quitar carpeta ${project.root}`}
                  onClick={() => unpark.mutate(project.root.split('/').slice(0, -1).join('/'))}
                >
                  <Unplug className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
          <Separator className="my-4" />
        </section>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Sitios vinculados</h3>
        {sites.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no hay sitios. Vincula un proyecto detectado o crea uno.
          </p>
        ) : null}
        {sites.map((site) => (
          <SiteSettingsCard
            key={site.id}
            site={site}
            phpOptions={phpOptions}
            nodeOptions={nodeOptions}
          />
        ))}
      </section>

      <NewSiteDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <Dialog open={parkOpen} onOpenChange={setParkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir carpeta de proyectos</DialogTitle>
            <DialogDescription>
              Cada subcarpeta con un proyecto se mostrará como <code>.test</code>.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={folder}
            placeholder="~/Lair"
            onChange={(event) => setFolder(event.target.value)}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setParkOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!folder.trim() || park.isPending}
              onClick={() => {
                park.mutate(folder.trim())
                setFolder('')
                setParkOpen(false)
              }}
            >
              Añadir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PaneView>
  )
}
