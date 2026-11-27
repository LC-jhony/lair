import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { flock } from '@/lib/ipc'

export const binariesQueryKey = ['binaries'] as const
export const versionsQueryKey = (packageName?: string) =>
  ['versions', packageName ?? 'all'] as const
export const caddyQueryKey = ['caddy'] as const

function refreshBinaries(client: ReturnType<typeof useQueryClient>) {
  void client.invalidateQueries({ queryKey: binariesQueryKey })
  void client.invalidateQueries({ queryKey: ['onboarding'] })
}

export function useBinaries() {
  return useQuery({
    queryKey: binariesQueryKey,
    queryFn: () => flock.binaries.list(),
  })
}

export function useVersions(packageName?: string) {
  return useQuery({
    queryKey: versionsQueryKey(packageName),
    queryFn: () => flock.binaries.versions(packageName),
  })
}

export function useCaddyStatus() {
  return useQuery({
    queryKey: caddyQueryKey,
    queryFn: () => flock.caddy.status(),
  })
}

/** Instala una versión concreta del catálogo firmado. */
export function useInstallVersion() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (payload: { package: string; version: string }) =>
      flock.binaries.install(payload),
    onSuccess: () => refreshBinaries(client),
  })
}

export function useSetDefaultVersion() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (payload: { package: string; version: string }) =>
      flock.binaries.setDefault(payload),
    onSuccess: () => refreshBinaries(client),
  })
}

export function useUninstallVersion() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (payload: { package: string; version: string }) =>
      flock.binaries.uninstall(payload),
    onSuccess: () => refreshBinaries(client),
  })
}

export function usePathStatus() {
  return useQuery({
    queryKey: ['system', 'path'],
    queryFn: () => flock.system.pathStatus(),
  })
}

export function useEnsurePath() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => flock.system.ensurePath(),
    onSuccess: () => client.invalidateQueries({ queryKey: ['system', 'path'] }),
  })
}

export function useRemovePath() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => flock.system.removePath(),
    onSuccess: () => client.invalidateQueries({ queryKey: ['system', 'path'] }),
  })
}

export function useVerifyBinaries() {
  return useMutation({
    mutationFn: () => flock.binaries.verify(),
  })
}

export function useCaStatus() {
  return useQuery({
    queryKey: ['caddy', 'ca'],
    queryFn: () => flock.caddy.caStatus(),
  })
}

export function useGlobalOptions() {
  return useQuery({
    queryKey: ['caddy', 'global-options'],
    queryFn: () => flock.caddy.globalOptions(),
  })
}

export function useSetGlobalOptions() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (options: string) => flock.caddy.setGlobalOptions(options),
    onSuccess: () => client.invalidateQueries({ queryKey: ['caddy', 'global-options'] }),
  })
}

export function useTrustCa() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => flock.caddy.trustCa(),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['caddy', 'ca'] })
      void client.invalidateQueries({ queryKey: ['onboarding'] })
    },
  })
}

export function useInstallComposer() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => flock.binaries.installComposer(),
    onSuccess: () => refreshBinaries(client),
  })
}

/** Compatibilidad con el onboarding y el demo anterior. */
export function useInstallBinary() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => flock.binaries.installLatest(id),
    onSuccess: () => refreshBinaries(client),
  })
}
