import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ipc } from '@/lib/ipc'
import { generateCaddyfile } from '@/lib/caddyfile'
import type { NewSiteInput, Site } from '@/lib/types'

export const sitesQueryKey = ['sites'] as const

export function useSites() {
  return useQuery({
    queryKey: sitesQueryKey,
    queryFn: () => ipc.listSites(),
  })
}

export function useCreateSite() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: NewSiteInput) => ipc.createSite(input),
    onSuccess: () => client.invalidateQueries({ queryKey: sitesQueryKey }),
  })
}

export function useRemoveSite() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => ipc.deleteSite(id),
    onSuccess: () => client.invalidateQueries({ queryKey: sitesQueryKey }),
  })
}

export function useReloadCaddy() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (sites: Site[]) =>
      ipc.caddyReload(sites.map((site) => generateCaddyfile(site)).join('\n')),
    onSuccess: () => client.invalidateQueries({ queryKey: ['caddy'] }),
  })
}
