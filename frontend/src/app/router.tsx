import type { ComponentType } from 'react'
import { createBrowserRouter } from 'react-router'

import { AppShell } from './AppShell'

type PageModule = { default: ComponentType }

/** Route-level code splitting keeps the initial bundle small (performance budget PB-15). */
const page = (load: () => Promise<PageModule>) => async () => ({
  Component: (await load()).default,
})

export const router = createBrowserRouter([
  {
    Component: AppShell,
    children: [
      { index: true, lazy: page(() => import('@/features/dashboard/DashboardPage')) },
      { path: 'topology', lazy: page(() => import('@/features/topology/TopologyPage')) },
      { path: 'telemetry', lazy: page(() => import('@/features/telemetry/TelemetryPage')) },
      { path: 'scenarios', lazy: page(() => import('@/features/scenarios/ScenariosPage')) },
      { path: 'simulations', lazy: page(() => import('@/features/simulations/SimulationsPage')) },
      { path: 'incidents', lazy: page(() => import('@/features/incidents/IncidentsPage')) },
      { path: 'benchmarks', lazy: page(() => import('@/features/benchmarks/BenchmarksPage')) },
      { path: '*', lazy: page(() => import('./NotFoundPage')) },
    ],
  },
])
