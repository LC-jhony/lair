import { useEffect, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Download,
  Loader2,
  ShieldCheck,
  TerminalSquare,
} from 'lucide-react'
import { Bird } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useOnboarding } from '@/hooks/useOnboarding'
import {
  useCaStatus,
  useEnsurePath,
  useInstallComposer,
  usePathStatus,
  useTrustCa,
} from '@/hooks/useBinaries'

type StepState = 'pending' | 'running' | 'done' | 'error'

const ITEMS = [
  { id: 'caddy', label: 'Caddy', detail: 'Reverse proxy local con HTTPS', icon: ShieldCheck },
  { id: 'runtimes', label: 'PHP y Node', detail: 'Versiones gestionadas por proyecto', icon: TerminalSquare },
  { id: 'composer', label: 'Composer', detail: 'Gestor de dependencias de PHP', icon: Download },
  { id: 'path', label: 'PATH del sistema', detail: 'Shims disponibles en nuevas terminales', icon: TerminalSquare },
  { id: 'ca', label: 'Certificado local', detail: 'Confía en la CA de Caddy para .test', icon: ShieldCheck },
] as const

type ItemId = (typeof ITEMS)[number]['id']

export function OnboardingWizard() {
  const { isLoading, isComplete, complete, installCaddy, installBinaries } = useOnboarding()
  const installComposer = useInstallComposer()
  const ensurePath = useEnsurePath()
  const trustCa = useTrustCa()
  const { data: path } = usePathStatus()
  const { data: ca } = useCaStatus()

  const [dismissed, setDismissed] = useState(false)
  const [started, setStarted] = useState(false)
  const [finished, setFinished] = useState(false)
  const [addToPath, setAddToPath] = useState(true)
  const [states, setStates] = useState<Record<ItemId, StepState>>({
    caddy: 'pending',
    runtimes: 'pending',
    composer: 'pending',
    path: 'pending',
    ca: 'pending',
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onReset = () => {
      setDismissed(false)
      setStarted(false)
      setFinished(false)
      setError(null)
      setStates({
        caddy: 'pending',
        runtimes: 'pending',
        composer: 'pending',
        path: 'pending',
        ca: 'pending',
      })
    }
    window.addEventListener('flock:onboarding-reset', onReset)
    return () => window.removeEventListener('flock:onboarding-reset', onReset)
  }, [])

  if (isLoading || isComplete || dismissed) return null

  const doneCount = Object.values(states).filter((value) => value === 'done').length
  const progress = Math.round((doneCount / ITEMS.length) * 100)
  const busy = Object.values(states).some((value) => value === 'running')

  const run = async () => {
    setStarted(true)
    setError(null)
    setStates({
      caddy: 'pending',
      runtimes: 'pending',
      composer: 'pending',
      path: 'pending',
      ca: 'pending',
    })

    const actions: Array<{ id: ItemId; execute: () => Promise<unknown> }> = [
      { id: 'caddy', execute: () => installCaddy.mutateAsync() },
      { id: 'runtimes', execute: () => installBinaries.mutateAsync() },
      { id: 'composer', execute: () => installComposer.mutateAsync() },
      { id: 'path', execute: () => (addToPath ? ensurePath.mutateAsync() : Promise.resolve()) },
      { id: 'ca', execute: () => trustCa.mutateAsync() },
    ]

    for (const action of actions) {
      setStates((current) => ({ ...current, [action.id]: 'running' }))
      try {
        await action.execute()
        setStates((current) => ({ ...current, [action.id]: 'done' }))
      } catch (failure) {
        setStates((current) => ({ ...current, [action.id]: 'error' }))
        setError((failure as Error).message)
        return
      }
    }
    setFinished(true)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader className="space-y-3 border-b pb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bird className="size-6 text-primary" aria-hidden="true" />
              <span className="text-sm font-semibold uppercase tracking-wide">Flock Herd</span>
            </div>
            <Badge variant="outline">Configuración inicial</Badge>
          </div>
          <div>
            <CardTitle className="text-2xl">
              {finished ? 'Todo está listo' : started ? 'Instalando tu entorno' : 'Bienvenido a Flock Herd'}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {finished
                ? 'Puedes abrir la aplicación. Las herramientas estarán disponibles en terminales nuevas.'
                : started
                  ? 'Estamos descargando y configurando los componentes. No cierres esta ventana.'
                  : 'Prepara tu entorno de desarrollo local en unos minutos. Cada descarga se verifica antes de instalarse.'}
            </p>
          </div>
          {started ? (
            <div className="space-y-2 pt-1">
              <Progress value={progress} showLabel />
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-5 pt-5">
          {!started ? (
            <div className="space-y-3">
              {ITEMS.map(({ id, label, detail, icon: Icon }) => (
                <div key={id} className="flex items-center gap-3 rounded-lg border p-3">
                  <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{detail}</p>
                  </div>
                </div>
              ))}
              <label className="flex items-start gap-3 rounded-lg bg-muted/40 p-3 text-sm">
                <input
                  type="checkbox"
                  checked={addToPath}
                  onChange={(event) => setAddToPath(event.target.checked)}
                  className="mt-0.5 size-4 accent-current"
                />
                <span>
                  Añadir <code>~/.local/share/lair/bin</code> al PATH de mis shells.
                  <span className="block text-xs text-muted-foreground">
                    Reversible y aplicable a terminales nuevas. Ahora: {path?.ok ? 'ya configurado' : 'pendiente'}.
                  </span>
                </span>
              </label>
            </div>
          ) : (
            <div className="space-y-2">
              {ITEMS.map(({ id, label, detail }) => {
                const state = states[id]
                return (
                  <div key={id} className="flex items-center gap-3 rounded-lg border p-3">
                    {state === 'done' ? (
                      <CheckCircle2 className="size-5 shrink-0 text-emerald-500" aria-hidden="true" />
                    ) : state === 'running' ? (
                      <Loader2 className="size-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
                    ) : state === 'error' ? (
                      <Circle className="size-5 shrink-0 text-destructive" aria-hidden="true" />
                    ) : (
                      <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{detail}</p>
                    </div>
                    <Badge variant={state === 'done' ? 'success' : state === 'error' ? 'warning' : 'secondary'}>
                      {state === 'done' ? 'Listo' : state === 'running' ? 'Instalando' : state === 'error' ? 'Error' : 'Pendiente'}
                    </Badge>
                  </div>
                )
              })}
              {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
              {states.ca === 'done' && !ca?.available ? (
                <p className="text-xs text-muted-foreground">
                  El certificado se marcó como confiado; Caddy podrá usarlo cuando arranque.
                </p>
              ) : null}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t pt-4">
            <Button
              variant="ghost"
              onClick={() => setDismissed(true)}
              disabled={busy}
            >
              {finished ? 'Ahora no' : 'Omitir'}
            </Button>
            {finished ? (
              <Button
                onClick={async () => {
                  await complete.mutateAsync()
                  setDismissed(true)
                }}
                disabled={complete.isPending}
              >
                Abrir Lair <ArrowRight className="size-4" />
              </Button>
            ) : started && Object.values(states).some((value: StepState) => value === 'error') ? (
              <Button onClick={() => void run()} disabled={busy}>
                Reintentar
              </Button>
            ) : started ? null : (
              <Button onClick={() => void run()}>
                Comenzar instalación <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
