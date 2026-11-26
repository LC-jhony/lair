import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Dashboard } from '@/components/dashboard/Dashboard'
import { SitesPane } from '@/components/sites/SitesPane'
import { BinaryPanel } from '@/components/dashboard/BinaryPanel'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { PlaceholderPane } from '@/components/panes/PlaceholderPane'
import { RuntimePane } from '@/components/panes/RuntimePane'
import { ServicesPane } from '@/components/panes/ServicesPane'
import { PANES } from '@/components/panes/panes'

const RUNTIME_PANES = ['php', 'node']
const IMPLEMENTED_PANES = ['sites', 'services', ...RUNTIME_PANES]
/** El resto de panes siguen siendo placeholders de fases posteriores. */
const placeholderRoutes = PANES.filter((pane) => !IMPLEMENTED_PANES.includes(pane.id))

export default function App() {
  return (
    <HashRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sites" element={<SitesPane />} />
          <Route path="/services" element={<ServicesPane />} />
          <Route path="/binaries" element={<BinaryPanel />} />
          {RUNTIME_PANES.map((id) => (
            <Route key={id} path={`/${id}`} element={<RuntimePane id={id} />} />
          ))}
          {placeholderRoutes.map((pane) => (
            <Route key={pane.id} path={`/${pane.id}`} element={<PlaceholderPane id={pane.id} />} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
      <OnboardingWizard />
    </HashRouter>
  )
}
