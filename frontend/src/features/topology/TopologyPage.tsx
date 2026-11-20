import { PlannedFeature } from '@/components/PlannedFeature'

export default function TopologyPage() {
  return (
    <PlannedFeature
      title="Network topology"
      description="Interactive view of the simulated RAN: core, transport links, CU, DUs, RUs, cells, and UE groups."
      phase={1}
      highlights={[
        'Two seeded topologies: demo-small (13 components) and demo-medium (23 components)',
        'Backhaul, midhaul, and fronthaul links styled by type',
        'Component details panel with metadata and live status',
        'Filters by component type and status, plus a legend',
        'Incident-affected components highlighted (Phase 5)',
      ]}
    />
  )
}
