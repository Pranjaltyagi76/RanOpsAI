import { queryOptions, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { apiFetch } from '@/lib/api'
import type { HealthResponse } from '@/types/api'

/**
 * The backend runs on a free instance that sleeps after ~15 minutes idle; the first request
 * then waits ~30–60 s while it boots. `/health` never touches the database, so warming the
 * backend does not wake Neon.
 */
const WARMUP_TIMEOUT_MS = 90_000
const SLOW_AFTER_MS = 2_000

export const healthQueryOptions = queryOptions({
  queryKey: ['health'],
  queryFn: ({ signal }) =>
    apiFetch<HealthResponse>('/health', { signal, timeoutMs: WARMUP_TIMEOUT_MS }),
  staleTime: Infinity,
  retry: 3,
  retryDelay: (attempt) => Math.min(2_000 * 2 ** attempt, 15_000),
})

export type BackendStatus = 'checking' | 'waking' | 'ready' | 'unreachable'

export function useBackendWarmup() {
  const query = useQuery(healthQueryOptions)
  const [slow, setSlow] = useState(false)
  // Pending on first load, or fetching again after a failure (manual retry).
  const connecting = !query.isSuccess && (query.isPending || query.isFetching)

  useEffect(() => {
    if (!connecting) return
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS)
    return () => {
      clearTimeout(timer)
      setSlow(false)
    }
  }, [connecting])

  let status: BackendStatus
  if (query.isSuccess) status = 'ready'
  else if (connecting) status = slow ? 'waking' : 'checking'
  else status = 'unreachable'

  return { status, health: query.data, error: query.error, retry: query.refetch }
}

/** Gate for data queries: `useQuery({ ..., enabled: useBackendReady() })`. */
export function useBackendReady(): boolean {
  return useQuery(healthQueryOptions).isSuccess
}
