import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ipc } from '@/lib/ipc'
import { useTrustCa } from './useBinaries'
import { useStatusBanner } from '@/components/layout'
import { generateCaddyfile } from '@/lib/caddyfile'
import type { NewSiteInput, Site } from '@/lib/types'

export const sitesQueryKey = ['sites'] as const
export const parkedQueryKey = ['parked'] as const

function refreshSites(client: ReturnType<typeof useQueryClient>) {
  void client.invalidateQueries({ queryKey: sitesQueryKey })
  void client.invalidateQueries({ queryKey: parkedQueryKey })
}

export function useSites() {
  return useQuery({
    queryKey: sitesQueryKey,
    queryFn: () => ipc.listSites(),
  })
}

export function useSiteEnvironment(host?: string) {
  return useQuery({
    queryKey: ['site-environment', host ?? 'none'],
    queryFn: () => ipc.siteEnvironment(host ?? 'acme.test'),
    retry: false,
  })
}

export function useParked() {
  return useQuery({
    queryKey: parkedQueryKey,
    queryFn: () => ipc.listParked(),
  })
}

export function useCreateSite() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: NewSiteInput) => ipc.createSite(input),
    onSuccess: () => refreshSites(client),
  })
}

export function useRemoveSite() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => ipc.deleteSite(id),
    onSuccess: () => refreshSites(client),
  })
}

export function useUpdateSite() {
  const client = useQueryClient()
  const banner = useStatusBanner()
  const reload = useReloadCaddy()
  const trust = useTrustCa()

  return useMutation({
    mutationFn: async (payload: { id: string } & Partial<Site>) => {
      const before = client.getQueryData<Site[]>(sitesQueryKey) ?? []
      const previous = before.find((site) => site.id === payload.id)
      const result = await ipc.updateSite(payload)

      if (payload.tlsInternal === true && previous?.tlsInternal === false) {
        await trust.mutateAsync().catch(() => null)
      }

      const after = before.map((site) =>
        site.id === payload.id ? { ...site, ...payload } : site,
      )
      try {
        const result = await reload.mutateAsync(after)
        if ((result as { skipped?: boolean })?.skipped) {
          banner.notify(
            'HTTPS guardado y Caddyfile actualizado. Caddy no recargó: admin :2019 no disponible.',
          )
        } else {
          banner.report(null)
        }
      } catch (error) {
        banner.report(
          `HTTPS actualizado en la configuración, pero Caddy no recargó: ${(error as Error).message}`,
        )
      }
      return result
    },
    onSuccess: () => refreshSites(client),
  })
}

export function useParkFolder() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (root: string) => ipc.parkFolder(root),
    onSuccess: () => refreshSites(client),
  })
}

export function useUnparkFolder() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (root: string) => ipc.unparkFolder(root),
    onSuccess: () => refreshSites(client),
  })
}

export function useWorktrees(root: string | undefined) {
  return useQuery({
    queryKey: ['worktrees', root],
    queryFn: () => ipc.listWorktrees(root ?? ''),
    enabled: Boolean(root),
  })
}

export function useAddWorktree() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (payload: { root: string; branch: string }) => ipc.addWorktree(payload),
    onSuccess: () => client.invalidateQueries({ queryKey: ['worktrees'] }),
  })
}

export function useRemoveWorktree() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (payload: { root: string; path: string }) => ipc.removeWorktree(payload),
    onSuccess: () => client.invalidateQueries({ queryKey: ['worktrees'] }),
  })
}

export function useReloadCaddy() {
  const client = useQueryClient()
  const banner = useStatusBanner()
  return useMutation({
    mutationFn: async (sites: Site[]) => {
      const { options } = await ipc.caddyGlobalOptions()
      const globals = options?.trim() ? `${options.trim()}\n\n` : ''
      return ipc.caddyReload(globals + sites.map((site) => generateCaddyfile(site)).join('\n'))
    },
    onSuccess: (result) => {
      const data = result as { warnings?: Array<{ message?: string }>; skipped?: boolean }
      const warnings = data?.warnings ?? []
      if (data?.skipped) {
        banner.notify('Caddyfile guardado. Caddy no recargó: admin :2019 no disponible.')
      } else {
        banner.report(
          warnings.length ? warnings.map((item) => item.message ?? 'advertencia').join(' · ') : null,
        )
      }
      void client.invalidateQueries({ queryKey: ['caddy'] })
    },
  })
}
