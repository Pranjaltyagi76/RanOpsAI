import { PlannedFeature } from '@/components/PlannedFeature'

export default function IncidentsPage() {
  return (
    <PlannedFeature
      title="Incidents"
      description="Grouped anomalies, investigations, and evaluation results."
      phase={5}
      highlights={[
        'Detections grouped by topology and time into incidents',
        'Timeline, evidence, and affected components',
        'Evidence-grounded investigation with confidence and abstention (Phase 6)',
        'Scores against hidden ground truth, revealed after evaluation (Phase 7)',
      ]}
    />
  )
}
