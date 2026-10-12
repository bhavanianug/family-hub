import type { ReactNode } from 'react'

import { ConnectionStatus } from '../components/ConnectionStatus'
import { useAuth } from '../features/auth/AuthProvider'
import type { ConnectionState } from '../types/health'

export type AppPage = 'dashboard' | 'calendar' | 'opportunities' | 'group'

const navItems: { id: AppPage; label: string }[] = [
  { id: 'dashboard', label: 'Home' },
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
      <div className="app-shell mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 pb-16 pt-5 sm:px-8 sm:pt-6">
        <header className="animate-fade-up flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="text-left"
          >
            <p className="text-[10px] font-bold tracking-[0.28em] text-sage-deep uppercase">
              Chicago · teens + family
            </p>
            <h1 className="brand-mark mt-1 font-display text-3xl font-extrabold leading-none sm:text-4xl">
              Family Hub
            </h1>
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <ConnectionStatus connection={connection} />
            <div className="flex items-center gap-2 text-sm text-ink-soft">
              <span className="hidden max-w-[12rem] truncate sm:inline">
                {user?.email}
              </span>
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-lg px-2.5 py-1.5 font-semibold text-ink-soft transition hover:bg-ink/5 hover:text-ink"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <div className="accent-bar mt-4" />

        <nav
          className="animate-fade-up mt-5 flex gap-1 overflow-x-auto pb-1"
          style={{ animationDelay: '80ms' }}
          aria-label="Primary"
        >
          {navItems.map((item) => {
            const active = page === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
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

        <main
          className="animate-fade-up mt-8 flex-1"
          style={{ animationDelay: '120ms' }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
