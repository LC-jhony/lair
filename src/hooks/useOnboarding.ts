import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { flock } from '@/lib/ipc'
import { isFullyInstalled, missingPackages } from '@/lib/onboarding'

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
      // Composer no está en el manifiesto: lo instala su propio paso.
      for (const name of missingPackages(binaries)) {
        await flock.binaries.installLatest(name)
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

  // Si los tres pasos ya estaban hechos al arrancar (instalación anterior que
  // no llegó a sellar `completedAt`), lo persistimos y entramos directo a la
  // app, igual que Flock. Solo se evalúa en la primera lectura: durante el
  // wizard, los pasos recién completados no deben cerrarlo prematuramente.
  const checkedOnStart = useRef(false)
  useEffect(() => {
    if (!query.isSuccess || checkedOnStart.current) return
    checkedOnStart.current = true
    const data = query.data
    if (!data?.completedAt && isFullyInstalled(data)) {
      void flock.onboarding.complete()
        .then(() => void client.invalidateQueries({ queryKey: onboardingQueryKey }))
        .catch(() => {})
    }
  }, [client, query.isSuccess, query.data])

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
