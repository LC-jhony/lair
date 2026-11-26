import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CheckboxField, Description, Field, Label } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useCreateSite } from '@/hooks/useSites'
import type { SiteKind } from '@/lib/types'

interface NewSiteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const KIND_OPTIONS = [
  { value: 'php', label: 'PHP' },
  { value: 'node', label: 'Node.js' },
  { value: 'static', label: 'Static' },
]

export function NewSiteDialog({ open, onOpenChange }: NewSiteDialogProps) {
  const createSite = useCreateSite()
  const [name, setName] = useState('')
  const [root, setRoot] = useState('')
  const [domains, setDomains] = useState('')
  const [kind, setKind] = useState<SiteKind>('php')
  const [phpVersion, setPhpVersion] = useState('8.4')
  const [nodeVersion, setNodeVersion] = useState('22.11.0')
  const [tlsInternal, setTlsInternal] = useState(true)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || !root.trim()) return
    createSite.mutate(
      {
        name: name.trim(),
        root: root.trim(),
        kind,
        domains: domains
          .split(',')
          .map((domain) => domain.trim())
          .filter(Boolean),
        phpVersion: kind === 'php' ? phpVersion : undefined,
        nodeVersion: kind === 'node' ? nodeVersion : undefined,
        tlsInternal,
      },
      {
        onSuccess: () => {
          setName('')
          setRoot('')
          setDomains('')
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo sitio</DialogTitle>
          <DialogDescription>
            Registra un proyecto local y asígnale dominios de desarrollo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <Label htmlFor="site-name">Nombre</Label>
              <Input id="site-name" placeholder="myapp" value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field>
              <Label>Tipo</Label>
              <Select
                label="Tipo de sitio"
                value={kind}
                onChange={(value) => setKind(value as SiteKind)}
                options={KIND_OPTIONS}
                className="w-full"
              />
              <Description>El servidor que sirve el sitio.</Description>
            </Field>
          </div>
          <Field>
            <Label htmlFor="site-root">Ruta del proyecto</Label>
            <Input id="site-root" placeholder="~/Sites/myapp" value={root} onChange={(e) => setRoot(e.target.value)} required />
          </Field>
          <Field>
            <Label htmlFor="site-domains">Dominios (separados por coma)</Label>
            <Input id="site-domains" placeholder="myapp.test, www.myapp.test" value={domains} onChange={(e) => setDomains(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            {kind === 'php' && (
              <Field>
                <Label htmlFor="php-version">Versión de PHP</Label>
                <Input id="php-version" value={phpVersion} onChange={(e) => setPhpVersion(e.target.value)} />
              </Field>
            )}
            {kind === 'node' && (
              <Field>
                <Label htmlFor="node-version">Versión de Node</Label>
                <Input id="node-version" value={nodeVersion} onChange={(e) => setNodeVersion(e.target.value)} />
              </Field>
            )}
          </div>
          <CheckboxField label="TLS interno (certificado local)" checked={tlsInternal} onChange={setTlsInternal} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createSite.isPending}>
              {createSite.isPending ? 'Creando…' : 'Crear sitio'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
