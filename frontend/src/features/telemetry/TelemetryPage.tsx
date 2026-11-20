import { PlannedFeature } from '@/components/PlannedFeature'

export default function TelemetryPage() {
  return (
    <PlannedFeature
      title="Telemetry explorer"
      description="Explore synthetic KPIs per run, component, metric, and time range."
      phase={2}
      highlights={[
        'Deterministic time series with noise, daily patterns, drift, and harmless spikes',
        'Server-side downsampling for fast charts',
        'Anomaly markers, data-gap markers, and threshold overlays (Phase 4)',
      ]}
    />
  )
}
