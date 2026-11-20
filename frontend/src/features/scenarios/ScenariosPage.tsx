import { PlannedFeature } from '@/components/PlannedFeature'

export default function ScenariosPage() {
  return (
    <PlannedFeature
      title="Scenario library"
      description="Fault and control scenarios you can inject into a simulation."
      phase={3}
      highlights={[
        'Ten scenarios, from backhaul degradation to KPI drift and normal variation',
        'Severity options and target requirements for each scenario',
        'Hidden ground truth is never shown before evaluation',
      ]}
    />
  )
}
