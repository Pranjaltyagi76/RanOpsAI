import { useQuery } from '@tanstack/react-query'
import { Database, RotateCw, Server } from 'lucide-react'
import type { ReactNode } from 'react'

import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useBackendWarmup } from '@/hooks/useBackendWarmup'
import { API_BASE_URL, apiFetch } from '@/lib/api'
import type { ReadinessResponse } from '@/types/api'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-2 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  )
}

const STATUS_BADGE = {
  checking: <Badge variant="secondary">Checking…</Badge>,
  waking: <Badge variant="secondary">Waking up…</Badge>,
  ready: <Badge className="bg-success/15 text-success">Online</Badge>,
  unreachable: <Badge variant="destructive">Unreachable</Badge>,
} as const

export default function AboutPage() {
  const { status, health, retry } = useBackendWarmup()

  // Only on explicit request: this endpoint touches the database and would wake Neon.
  const readiness = useQuery({
    queryKey: ['health', 'ready'],
    queryFn: ({ signal }) => apiFetch<ReadinessResponse>('/health/ready', { signal }),
    enabled: false,
    retry: false,
  })

  return (
    <>
      <PageHeader
        title="About"
        description="Application information, backend status, and how this free-tier demo is hosted."
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="size-4 text-primary" aria-hidden />
              <CardTitle className="text-base">Backend</CardTitle>
              <span className="ml-auto">{STATUS_BADGE[status]}</span>
            </div>
            <CardDescription className="break-all">{API_BASE_URL}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl>
              <Row label="Version">{health?.version ?? '—'}</Row>
              <Row label="Environment">{health?.environment ?? '—'}</Row>
              <Row label="Demo mode">{health ? (health.demo_mode ? 'On' : 'Off') : '—'}</Row>
              <Row label="Investigation provider">{health?.ai_provider ?? '—'}</Row>
            </dl>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void retry()}
              disabled={status === 'checking' || status === 'waking'}
            >
              <RotateCw aria-hidden />
              Check again
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="size-4 text-primary" aria-hidden />
              <CardTitle className="text-base">Database</CardTitle>
              <span className="ml-auto">
                {readiness.isFetching ? (
                  <Badge variant="secondary">Checking…</Badge>
                ) : readiness.isSuccess ? (
                  <Badge className="bg-success/15 text-success">Connected</Badge>
                ) : readiness.isError ? (
                  <Badge variant="destructive">Not ready</Badge>
                ) : (
                  <Badge variant="outline">Not checked</Badge>
                )}
              </span>
            </div>
            <CardDescription>
              Serverless PostgreSQL that sleeps when idle. Checked only when you ask, so browsing
              this page does not wake it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {readiness.isError && (
              <p className="text-sm text-destructive">{readiness.error.message}</p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void readiness.refetch()}
              disabled={status !== 'ready' || readiness.isFetching}
            >
              <Database aria-hidden />
              Check database connection
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">About this project</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              RANOps AI simulates a small 5G / Open RAN network, injects controlled faults, detects
              anomalies, investigates incidents with evidence, and scores each diagnosis against
              hidden ground truth. All data is synthetic.
            </p>
            <p>
              It runs entirely on free tiers — frontend on Vercel, API on Render, PostgreSQL on
              Neon. The API sleeps after about 15 minutes without traffic, so the first request
              after a pause can take 30–60 seconds.
            </p>
            <p>
              Independent portfolio project inspired by the Open RAN domain served by Airspan
              Networks. It is not an Airspan product and never connects to real network equipment.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
