import { VersionCatalog } from '@/components/binaries/VersionCatalog'
import { PaneView } from '@/components/layout'
import { tr } from '@/lib/i18n'
import { findPane } from './panes'

/** Panes de PHP y Node: catálogo real de versiones del manifiesto firmado. */
export function RuntimePane({ id }: { id: string }) {
  const pane = findPane(id)
  if (!pane) return null
  return (
    <PaneView description={tr(pane.descriptionKey)} groupsKey={id}>
      <VersionCatalog packages={id === 'php' ? ['php', 'frankenphp'] : [id]} />
    </PaneView>
  )
}
