import { CloudOff, LoaderCircle, RotateCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useBackendWarmup } from '@/hooks/useBackendWarmup'

export function BackendStatusBanner() {
  const { status, error, retry } = useBackendWarmup()

  if (status === 'waking') {
    return (
      <div
        role="status"
        className="flex items-center gap-2 rounded-md border border-info/30 bg-info/10 px-3 py-2 text-sm text-info"
      >
        <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden />
        Waking up the backend (free hosting, ~30–60 s)…
      </div>
    )
  }

  if (status === 'unreachable') {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        <CloudOff className="size-4 shrink-0" aria-hidden />
        <span>Backend unreachable{error ? `: ${error.message}` : '.'}</span>
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => void retry()}>
          <RotateCw aria-hidden />
          Retry
        </Button>
      </div>
    )
  }

  return null
}
