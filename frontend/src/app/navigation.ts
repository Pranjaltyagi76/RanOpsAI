import {
  Activity,
  BarChart3,
  FlaskConical,
  Info,
  LayoutDashboard,
  type LucideIcon,
  Network,
  PlayCircle,
  Siren,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/topology', label: 'Topology', icon: Network },
  { to: '/telemetry', label: 'Telemetry', icon: Activity },
  { to: '/scenarios', label: 'Scenarios', icon: FlaskConical },
  { to: '/simulations', label: 'Simulations', icon: PlayCircle },
  { to: '/incidents', label: 'Incidents', icon: Siren },
  { to: '/benchmarks', label: 'Benchmarks', icon: BarChart3 },
  { to: '/about', label: 'About', icon: Info },
]
