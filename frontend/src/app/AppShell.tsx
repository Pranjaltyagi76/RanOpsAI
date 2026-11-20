import { NavLink, Outlet } from 'react-router'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from './navigation'

function Logo() {
  return (
    <NavLink to="/" className="flex items-center gap-2 font-semibold tracking-tight">
      <img src="/favicon.svg" alt="" className="size-7" />
      <span>
        RANOps <span className="text-primary">AI</span>
      </span>
    </NavLink>
  )
}

function NavItems({ orientation }: { orientation: 'vertical' | 'horizontal' }) {
  return (
    <nav
      aria-label="Main"
      className={cn(
        'flex gap-1',
        orientation === 'vertical' ? 'flex-col' : 'overflow-x-auto pb-1 [scrollbar-width:none]',
      )}
    >
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            cn(
              'flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
              isActive && 'bg-accent font-medium text-foreground',
            )
          }
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

export function AppShell() {
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r bg-card/40 p-4 md:flex">
        <Logo />
        <NavItems orientation="vertical" />
        <p className="mt-auto text-xs leading-relaxed text-muted-foreground">
          Independent simulation for learning and portfolio use. Not an Airspan product; no real
          network equipment is involved.
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex flex-col gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="md:hidden">
              <Logo />
            </div>
            <Badge variant="outline" className="ml-auto border-warning/50 text-warning">
              Synthetic demo data
            </Badge>
          </div>
          <div className="md:hidden">
            <NavItems orientation="horizontal" />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
