import { CheckCircle2, Circle, LoaderCircle } from 'lucide-react'

import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { type PhaseStatus, ROADMAP } from './roadmap'

const WORKFLOW = [
  ['Simulate', 'A small 5G / Open RAN topology produces deterministic synthetic telemetry.'],
  ['Inject', 'A controlled fault — or a blind Mystery incident — alters the telemetry.'],
  ['Detect', 'Robust statistics, Isolation Forest, and a data-gap detector flag anomalies.'],
  ['Group', 'Related detections are grouped into incidents using topology and time.'],
  ['Investigate', 'An evidence-grounded workflow proposes a root cause, or abstains.'],
  ['Evaluate', 'The diagnosis is scored against hidden ground truth it never saw.'],
] as const

const STATUS_STYLE: Record<PhaseStatus, { label: string; className: string; icon: typeof Circle }> =
  {
    done: { label: 'Done', className: 'text-success', icon: CheckCircle2 },
    'in-progress': { label: 'In progress', className: 'text-info', icon: LoaderCircle },
    planned: { label: 'Planned', className: 'text-muted-foreground', icon: Circle },
  }

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="RANOps AI"
        description="A simulated 5G / Open RAN operations platform: synthetic telemetry, fault injection, anomaly detection, and evidence-grounded incident investigation — scored honestly against hidden ground truth."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">How it works</CardTitle>
            <CardDescription>The pipeline every simulation run goes through.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-4 sm:grid-cols-2">
              {WORKFLOW.map(([step, text], index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{step}</p>
                    <p className="text-sm text-muted-foreground">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Build progress</CardTitle>
            <CardDescription>
              Live metrics replace this panel once simulations exist.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {ROADMAP.map(({ phase, name, status }) => {
                const style = STATUS_STYLE[status]
                const Icon = style.icon
                return (
                  <li key={phase} className="flex items-center gap-2 text-sm">
                    <Icon
                      className={cn('size-4 shrink-0', style.className)}
                      aria-label={style.label}
                    />
                    <span className="w-6 tabular-nums text-muted-foreground">{phase}</span>
                    <span className={cn(status === 'planned' && 'text-muted-foreground')}>
                      {name}
                    </span>
                    {status === 'in-progress' && (
                      <Badge variant="secondary" className="ml-auto">
                        Now
                      </Badge>
                    )}
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
