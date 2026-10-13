import type { AppPage } from '../layouts/AppLayout'

const modules = [
  {
    id: 'opportunities' as const,
    index: '01',
    title: 'Opportunities',
    description: 'Programs, deadlines, and status tracking.',
  },
  {
    id: 'college' as const,
    index: '02',
    title: 'College',
    description: 'Aid and plan timelines, plus key resources.',
  },
  {
    id: 'calendar' as const,
    index: '03',
    title: 'Calendar',
    description: 'Shared group schedule is next.',
  },
]

type DashboardPageProps = {
  onNavigate: (page: AppPage) => void
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  return (
    <div className="space-y-8">
      <section className="surface-panel animate-pop-in rounded-2xl p-6 sm:p-8">
        <p className="text-[11px] font-bold tracking-[0.22em] text-sage-deep uppercase">
          Home
        </p>
        <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          What’s next
        </h2>
        <p className="mt-2 max-w-xl text-ink-soft">
          Start with opportunities — add a program, set a deadline, and update
          your status. Calendar comes after.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('opportunities')}
          className="btn-primary mt-5 rounded-xl px-4 py-2.5 text-sm font-bold"
        >
          Open opportunities
        </button>
      </section>

      <section>
        <p className="text-xs font-bold tracking-[0.24em] text-sage-deep uppercase">
          Roadmap
        </p>
        <ul className="mt-5 divide-y divide-line border-y border-line">
          {modules.map((module) => (
            <li
              key={module.id}
              className="grid gap-2 py-6 sm:grid-cols-[4rem_1fr] sm:gap-6"
            >
              <span className="font-display text-2xl font-bold text-sage-deep/80">
                {module.index}
              </span>
              <div>
                <h3 className="font-display text-2xl font-bold tracking-tight text-ink">
                  {module.title}
                </h3>
                <p className="mt-1 max-w-xl text-ink-soft">{module.description}</p>
                {(module.id === 'opportunities' || module.id === 'college') && (
                  <button
                    type="button"
                    onClick={() => onNavigate(module.id)}
                    className="mt-3 text-sm font-bold text-sage hover:text-ink"
                  >
                    Open {module.title.toLowerCase()}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
