import { PlannedFeature } from '@/components/PlannedFeature'

export default function BenchmarksPage() {
  return (
    <PlannedFeature
      title="Benchmarks"
      description="Repeatable, seeded scenario suites that compare detector and agent versions."
      phase={7}
      highlights={[
        'Versioned suites (slice-v1, full-v1)',
        'Root-cause accuracy, detection recall, false-positive rate, detection delay, evidence quality',
        'Regression highlighting between versions',
        'HTML benchmark reports (Phase 9)',
      ]}
    />
  )
}
