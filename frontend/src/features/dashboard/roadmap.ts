export type PhaseStatus = 'done' | 'in-progress' | 'planned'

export interface RoadmapPhase {
  phase: number
  name: string
  status: PhaseStatus
}

/** Mirrors the tracker in context/phasewise_roadmap.md — update both together. */
export const ROADMAP: RoadmapPhase[] = [
  { phase: 0, name: 'Foundation and skeleton deployment', status: 'in-progress' },
  { phase: 1, name: 'Data model and topology', status: 'planned' },
  { phase: 2, name: 'Telemetry simulator', status: 'planned' },
  { phase: 3, name: 'Fault injection (first 3 scenarios)', status: 'planned' },
  { phase: 4, name: 'Anomaly detection', status: 'planned' },
  { phase: 5, name: 'Incidents', status: 'planned' },
  { phase: 6, name: 'Investigation (deterministic)', status: 'planned' },
  { phase: 7, name: 'Evaluation and benchmarks', status: 'planned' },
  { phase: 8, name: 'All 10 scenarios, Mystery mode, optional AI', status: 'planned' },
  { phase: 9, name: 'Reports and polish', status: 'planned' },
  { phase: 10, name: 'Testing and hardening', status: 'planned' },
  { phase: 11, name: 'Public release', status: 'planned' },
]
