import { VersionCatalog } from '@/components/binaries/VersionCatalog'
import { PaneView } from '@/components/layout'
import { tr } from '@/lib/i18n'
import { findPane } from './panes'

/** Servicios publicados para la plataforma actual (PostgreSQL, MySQL, Valkey…). */
const SERVICE_PACKAGES = [
  'postgres',
  'mysql',
  'mariadb',
  'mongodb',
  'valkey',
  'redis',
  'meilisearch',
  'typesense',
  'rustfs',
  'cloudflared',
]

export function ServicesPane() {
  const pane = findPane('services')
  if (!pane) return null
  return (
    <PaneView description={tr(pane.descriptionKey)} groupsKey="services">
      <VersionCatalog packages={SERVICE_PACKAGES} />
    </PaneView>
  )
}
