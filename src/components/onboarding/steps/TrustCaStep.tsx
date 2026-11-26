import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useOnboarding } from '@/hooks/useOnboarding'

interface StepProps {
  onNext: () => void
}

export function TrustCaStep(_props: StepProps) {
  const { state, trustCa } = useOnboarding()
  const trusted = Boolean(state?.caTrusted)

  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
        Para que el navegador acepte los certificados locales, añade el CA de flock
        al almacén de confianza de tu sistema.
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="size-4" />
          Certificado local
        </span>
        {trusted ? (
          <Badge variant="success"><CheckCircle2 className="size-3" /> Confiable</Badge>
        ) : (
          <Badge variant="outline">Pendiente</Badge>
        )}
      </div>

      {!trusted && (
        <div className="flex justify-end">
          <Button disabled={trustCa.isPending} onClick={() => trustCa.mutate()}>
            {trustCa.isPending && <Loader2 className="size-4 animate-spin" />}
            Confiar en el CA
          </Button>
        </div>
      )}
    </div>
  )
}
