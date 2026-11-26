import { Activity, Boxes, Globe2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useBinaries, useCaddyStatus } from '@/hooks/useBinaries'
import { useSites } from '@/hooks/useSites'
import { BinaryPanel } from './BinaryPanel'
import { SiteList } from './SiteList'

export function Dashboard() {
  const { data: sites } = useSites()
  const { data: binaries } = useBinaries()
  const { data: caddy } = useCaddyStatus()

  const activeSites = sites?.filter((site) => site.status !== 'stopped').length ?? 0
  const installedBinaries = binaries?.filter((binary) => binary.installed).length ?? 0

  const stats = [
    { label: 'Sitios activos', value: activeSites, icon: Globe2 },
    { label: 'Binarios instalados', value: installedBinaries, icon: Boxes },
    { label: 'Caddy', value: caddy?.running ? 'Online' : 'Offline', icon: Activity },
  ]

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tu entorno de desarrollo local, en un solo lugar.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{value}</CardContent>
          </Card>
        ))}
      </div>

      <SiteList />
      <BinaryPanel />
    </div>
  )
}
