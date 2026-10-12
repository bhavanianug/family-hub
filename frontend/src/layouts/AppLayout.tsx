import type { ReactNode } from 'react'

import { ConnectionStatus } from '../components/ConnectionStatus'
import { useAuth } from '../features/auth/AuthProvider'
import type { ConnectionState } from '../types/health'

export type AppPage = 'dashboard' | 'calendar' | 'opportunities' | 'group'

const navItems: { id: AppPage; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'opportunities', label: 'Opportunities' },
  { id: 'group', label: 'Group' },
]

type AppLayoutProps = {
  connection: ConnectionState
  page: AppPage
  onNavigate: (page: AppPage) => void
  children: ReactNode
}

export function AppLayout({
  connection,
  page,
  onNavigate,
  children,
}: AppLayoutProps) {
  const { user, signOut } = useAuth()

  return (
    <div className="app-sky">
      <div className="horizon-glow" aria-hidden="true" />
      <div className="app-shell mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 pb-16 pt-6 sm:px-8 sm:pt-8">
        <header className="animate-fade-up border-b border-white/15 pb-8">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-xl">
              <p className="text-[11px] font-bold tracking-[0.28em] text-sage uppercase">
                Chicago family OS
              </p>
              <h1 className="brand-mark mt-3 font-display text-[3.5rem] leading-[0.95] font-bold sm:text-7xl">
                Family Hub
              </h1>
              <div className="accent-bar mt-5" />
              <p className="mt-5 max-w-md text-base leading-relaxed text-white/80 sm:text-lg">
                Shared schedules and teen opportunities — one clear place for
                what’s next.
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 sm:items-end sm:pt-2">
              <ConnectionStatus connection={connection} />
              <div className="flex items-center gap-3 text-sm text-white/75">
                <span className="max-w-[14rem] truncate">{user?.email}</span>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="font-semibold text-sun transition hover:text-white"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </header>

        <nav
          className="animate-fade-up mt-5 flex flex-wrap gap-1 rounded-2xl bg-white/70 p-1.5 ring-1 ring-line backdrop-blur-md"
          style={{ animationDelay: '90ms' }}
          aria-label="Primary"
        >
          {navItems.map((item) => {
            const active = page === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                  active
                    ? 'bg-ink text-foam'
                    : 'nav-link text-ink-soft'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </button>
            )
          })}
        </nav>

        <main className="animate-fade-up mt-8 flex-1" style={{ animationDelay: '140ms' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
