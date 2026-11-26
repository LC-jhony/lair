import {
  Bug,
  FlaskConical,
  Globe2,
  Info,
  Mail,
  Package,
  Server,
  Settings2,
  Sparkles,
  Terminal,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface PaneMeta {
  id: string
  titleKey: string
  descriptionKey: string
  icon: LucideIcon
  /** Grupos previstos, para que el placeholder documente el alcance de cada fase. */
  planned: string[]
}

/** Orden exacto de la sidebar, tomado de `PANES` en `linux/src/window.rs`. */
export const PANES: PaneMeta[] = [
  {
    id: 'general',
    titleKey: 'settings.pane.general',
    descriptionKey: 'general.subtitle',
    icon: Settings2,
    planned: [
      'general.group.projects',
      'general.group.network',
      'general.group.data',
      'general.group.daemon',
      'general.group.startup',
    ],
  },
  {
    id: 'sites',
    titleKey: 'settings.pane.sites',
    descriptionKey: 'sites.subtitle',
    icon: Globe2,
    planned: ['sites.group.add', 'sites.group.list'],
  },
  {
    id: 'php',
    titleKey: 'settings.pane.php',
    descriptionKey: 'php.subtitle',
    icon: Terminal,
    planned: ['php.group.versions'],
  },
  {
    id: 'node',
    titleKey: 'settings.pane.node',
    descriptionKey: 'node.subtitle',
    icon: Package,
    planned: ['node.group.versions'],
  },
  {
    id: 'services',
    titleKey: 'settings.pane.services',
    descriptionKey: 'services.subtitle',
    icon: Server,
    planned: ['services.group.filters', 'services.group.installed'],
  },
  {
    id: 'mail',
    titleKey: 'settings.pane.mail',
    descriptionKey: 'mail.subtitle',
    icon: Mail,
    planned: ['mail.group.inbox'],
  },
  {
    id: 'dumps',
    titleKey: 'settings.pane.dumps',
    descriptionKey: 'dumps.subtitle',
    icon: FlaskConical,
    planned: ['dumps.group.capture', 'dumps.group.timeline'],
  },
  {
    id: 'debugger',
    titleKey: 'settings.pane.debugger',
    descriptionKey: 'debugger.subtitle',
    icon: Bug,
    planned: ['debugger.group.xdebug'],
  },
  {
    id: 'ai',
    titleKey: 'settings.pane.ai',
    descriptionKey: 'ai.subtitle',
    icon: Sparkles,
    planned: ['ai.group.clients'],
  },
  {
    id: 'about',
    titleKey: 'settings.pane.about',
    descriptionKey: 'about.subtitle',
    icon: Info,
    planned: ['about.group.app', 'about.group.support'],
  },
]

export const DEFAULT_PANE = PANES[0]

export function findPane(id: string | undefined): PaneMeta | undefined {
  return PANES.find((pane) => pane.id === id)
}
