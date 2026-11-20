import { CalendarClock } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from './PageHeader'

/**
 * Honest placeholder for pages whose functionality lands in a later roadmap phase.
 * It deliberately renders no buttons, so nothing on the page looks clickable but does nothing.
 */
export function PlannedFeature({
  title,
  description,
  phase,
  highlights,
}: {
  title: string
  description: string
  phase: number
  highlights: string[]
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarClock className="size-4 text-info" aria-hidden />
            <CardTitle className="text-base">Coming in Phase {phase}</CardTitle>
            <Badge variant="secondary">Planned</Badge>
          </div>
          <CardDescription>This page becomes interactive when its roadmap phase ships.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            {highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  )
}
