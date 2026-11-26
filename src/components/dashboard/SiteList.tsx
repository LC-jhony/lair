import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NewSiteDialog } from '@/components/sites/NewSiteDialog'
import { useSites } from '@/hooks/useSites'
import { SiteCard } from './SiteCard'

export function SiteList() {
  const { data: sites, isLoading, isError } = useSites()
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Sitios</h2>
          <p className="text-sm text-muted-foreground">Proyectos registrados en tu entorno local.</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Nuevo sitio
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando sitios…</p>}
      {isError && <p className="text-sm text-destructive">No se pudieron cargar los sitios.</p>}
      {sites?.length === 0 && (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Aún no hay sitios. Crea el primero para empezar.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sites?.map((site) => <SiteCard key={site.id} site={site} />)}
      </div>

      <NewSiteDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </section>
  )
}
