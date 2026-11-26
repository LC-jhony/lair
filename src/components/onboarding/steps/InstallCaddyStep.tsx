import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCaddyStatus } from '@/hooks/useBinaries'
import { useOnboarding } from '@/hooks/useOnboarding'

interface StepProps {
  onNext: () => void
}

export function InstallCaddyStep({ onNext }: StepProps) {
  const { data: caddy } = useCaddyStatus()
  const { installCaddy } = useOnboarding()
  // Solo el binario detectado cuenta como instalado: confiar la CA no instala Caddy.
  const installed = Boolean(caddy?.installed)

  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
        Caddy actúa como reverse proxy local y emite certificados HTTPS para tus dominios
        <code className="mx-1 text-foreground">.test</code>.
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <span className="text-sm font-medium">Caddy</span>
        {installed ? (
          <Badge variant="success"><CheckCircle2 className="size-3" /> Instalado</Badge>
        ) : (
          <Badge variant="outline">Pendiente</Badge>
        )}
      </div>

      <div className="flex justify-end gap-2">
        {installed ? (
          <Button onClick={onNext}>
            Continuar <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            disabled={installCaddy.isPending}
            onClick={() => installCaddy.mutate()}
          >
            {installCaddy.isPending && <Loader2 className="size-4 animate-spin" />}
            Instalar Caddy
          </Button>
        )}
      </div>
    </div>
  )
}
