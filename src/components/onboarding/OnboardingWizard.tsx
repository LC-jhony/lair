import { useEffect, useState } from 'react'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useOnboarding } from '@/hooks/useOnboarding'
import { InstallCaddyStep } from './steps/InstallCaddyStep'
import { InstallBinariesStep } from './steps/InstallBinariesStep'
import { TrustCaStep } from './steps/TrustCaStep'

const steps = [InstallCaddyStep, InstallBinariesStep, TrustCaStep]
const titles = ['Instalar Caddy', 'Instalar binarios', 'Confiar en el CA']
const descriptions = [
  'Paso 1 de 3 · Configura el reverse proxy local.',
  'Paso 2 de 3 · Elige las herramientas disponibles.',
  'Paso 3 de 3 · Habilita HTTPS en tus dominios.',
]

export function OnboardingWizard() {
  const { isLoading, isComplete, progress, state, complete } = useOnboarding()
  const [step, setStep] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const CurrentStep = steps[step]

  useEffect(() => {
    const onReset = () => {
      setDismissed(false)
      setStep(0)
    }
    window.addEventListener('flock:onboarding-reset', onReset)
    return () => window.removeEventListener('flock:onboarding-reset', onReset)
  }, [])

  if (isLoading || isComplete || dismissed) return null

  const allDone = Boolean(state?.caddyInstalled && state?.binariesInstalled && state?.caTrusted)

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) setDismissed(true)
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Bienvenido a flock herd</DialogTitle>
          <DialogDescription>{descriptions[step]}</DialogDescription>
          <div className="pt-2">
            <Progress value={progress} />
          </div>
        </DialogHeader>

        <div className="py-2">
          <h3 className="mb-4 text-base font-semibold">{titles[step]}</h3>
          <CurrentStep onNext={() => setStep((value) => Math.min(value + 1, steps.length - 1))} />
        </div>

        <DialogFooter className="items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {step + 1} / {steps.length}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setDismissed(true)}>
              Cerrar
            </Button>
          </div>
          {step === steps.length - 1 && (
            <Button
              disabled={!allDone || complete.isPending}
              onClick={() => complete.mutate()}
            >
              {complete.isPending ? 'Finalizando…' : 'Finalizar configuración'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
