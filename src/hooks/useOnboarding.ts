import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { flock } from '@/lib/ipc'

export const onboardingQueryKey = ['onboarding'] as const

export function useOnboarding() {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: onboardingQueryKey,
    queryFn: () => flock.onboarding.get(),
  })

  const refresh = () => {
    void client.invalidateQueries({ queryKey: onboardingQueryKey })
    void client.invalidateQueries({ queryKey: ['caddy'] })
    void client.invalidateQueries({ queryKey: ['binaries'] })
  }

  const installCaddy = useMutation({
    mutationFn: () => flock.caddy.install(),
    onSuccess: refresh,
  })

  const installBinaries = useMutation({
    mutationFn: async () => {
      const binaries = await flock.binaries.list()
      for (const binary of binaries) {
        if (!binary.installed) await flock.binaries.installLatest(binary.package)
      }
    },
    onSuccess: refresh,
  })

  const trustCa = useMutation({
    mutationFn: () => flock.caddy.trustCa(),
    onSuccess: refresh,
  })

  const complete = useMutation({
    mutationFn: () => flock.onboarding.complete(),
    onSuccess: refresh,
  })

  const reset = useMutation({
    mutationFn: () => flock.onboarding.reset(),
    onSuccess: () => {
      refresh()
      window.dispatchEvent(new Event('flock:onboarding-reset'))
    },
  })

  const state = query.data
  const completedSteps = [
    state?.caddyInstalled,
    state?.binariesInstalled,
    state?.caTrusted,
  ].filter(Boolean).length

  return {
    ...query,
    state,
    isComplete: Boolean(state?.completedAt),
    progress: Math.round((completedSteps / 3) * 100),
    installCaddy,
    installBinaries,
    trustCa,
    complete,
    reset,
  }
}
