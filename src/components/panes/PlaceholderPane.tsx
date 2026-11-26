import { Group, InfoRow, PaneView } from '@/components/layout'
import { tr } from '@/lib/i18n'
import { findPane } from './panes'

/**
 * Pane de la Fase 1: título, descripción y grupos previstos. No inventa datos del daemon;
 * las fases siguientes sustituyen este componente por el pane real conservando el mismo id.
 */
export function PlaceholderPane({ id }: { id: string }) {
  const pane = findPane(id)
  if (!pane) return null

  return (
    <PaneView description={tr(pane.descriptionKey)} groupsKey={pane.id}>
      <Group title={tr('pane.planned')} footer={tr('pane.phase', { n: 1 })}>
        {pane.planned.map((key) => (
          <InfoRow key={key} label={tr(key)} value="—" />
        ))}
      </Group>
    </PaneView>
  )
}
