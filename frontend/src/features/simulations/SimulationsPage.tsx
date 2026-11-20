import { PlannedFeature } from '@/components/PlannedFeature'

export default function SimulationsPage() {
  return (
    <PlannedFeature
      title="Simulations"
      description="Launch runs and follow their progress."
      phase={2}
      highlights={[
        'Normal runs with a chosen topology, duration, and seed (Phase 2)',
        'Fault injection with scenario, target, and severity (Phase 3)',
        'Mystery incident mode: the server picks a hidden fault (Phase 8)',
        'Live status while a run is queued or running',
      ]}
    />
  )
}
