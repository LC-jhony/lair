import { ArrowRight, CheckCircle2, Download, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useBinaries } from '@/hooks/useBinaries'
import { useOnboarding } from '@/hooks/useOnboarding'

interface StepProps {
  onNext: () => void
}

export function InstallBinariesStep({ onNext }: StepProps) {
  const { data: binaries } = useBinaries()
  const { state, installBinaries } = useOnboarding()
  const installed = Boolean(state?.binariesInstalled)

  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
        Instala las versiones gestionadas de PHP, Node.js y Composer para alternar entre
        proyectos sin tocar el sistema.
      </div>

      <div className="space-y-2">
        {binaries?.map((binary) => (
          <div key={binary.package} className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm font-medium">{binary.package}</span>
            <Badge variant={binary.installed ? 'success' : 'outline'}>
              {binary.installed && <CheckCircle2 className="size-3" />}
              {`v${binary.version}`}
            </Badge>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        {installed ? (
          <Button onClick={onNext}>
            Continuar <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            disabled={installBinaries.isPending}
            onClick={() => installBinaries.mutate()}
          >
            {installBinaries.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Instalar todo
          </Button>
        )}
      </div>
    </div>
  )
}
