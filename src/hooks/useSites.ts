import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ipc } from '@/lib/ipc'
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
  return useMutation({
    mutationFn: (payload: { id: string } & Partial<Site>) => ipc.updateSite(payload),
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
  return useMutation({
    mutationFn: (sites: Site[]) =>
      ipc.caddyReload(sites.map((site) => generateCaddyfile(site)).join('\n')),
    onSuccess: () => client.invalidateQueries({ queryKey: ['caddy'] }),
  })
}
