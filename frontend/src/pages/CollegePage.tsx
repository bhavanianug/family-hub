import { useState } from 'react'

import {
  collegeAid,
  collegeComingUp,
  collegePlan,
  type ResourceLink,
  type TimelineRow,
} from '../features/college/seed'

type CollegeTab = 'coming' | 'aid' | 'plan'

const tabs: { id: CollegeTab; label: string }[] = [
  { id: 'coming', label: 'Coming up' },
  { id: 'aid', label: 'Aid' },
  { id: 'plan', label: 'Plan' },
]

function TimelineList({ rows }: { rows: TimelineRow[] }) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {rows.map((row) => (
        <li
          key={`${row.when}-${row.what}`}
          className="grid gap-1 py-3 sm:grid-cols-[11rem_1fr] sm:gap-6"
        >
          <span className="text-sm font-bold text-sage">{row.when}</span>
          <span className="text-sm text-ink sm:text-base">{row.what}</span>
        </li>
      ))}
    </ul>
  )
}

function ResourceList({ links }: { links: ResourceLink[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {links.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-sage hover:text-ink"
          >
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  )
}

export function CollegePage() {
  const [tab, setTab] = useState<CollegeTab>('coming')

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] font-bold tracking-[0.22em] text-sage uppercase">
          Postsecondary
        </p>
        <h2 className="mt-1.5 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          College
        </h2>
      </div>

      <section>
        <div
          className="flex flex-wrap gap-1 border-b border-line"
          role="tablist"
          aria-label="College sections"
        >
          {tabs.map((item) => {
            const active = tab === item.id
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(item.id)}
                className={`px-4 py-2.5 text-sm font-bold transition ${
                  active
                    ? 'border-b-2 border-sage text-ink'
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        {tab === 'coming' && (
          <div className="mt-6" role="tabpanel">
            <ul className="divide-y divide-line border-y border-line">
              {collegeComingUp.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{item.title}</p>
                    <p className="mt-0.5 text-xs font-bold tracking-wide text-ink-soft uppercase">
                      {item.source === 'aid' ? 'Aid' : 'Plan'}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-sage">
                    {item.dateLabel}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'aid' && (
          <div className="mt-6 space-y-8" role="tabpanel">
            <div>
              <h4 className="text-[11px] font-bold tracking-[0.22em] text-sage uppercase">
                Timeline
              </h4>
              <div className="mt-3">
                <TimelineList rows={collegeAid.timeline} />
              </div>
            </div>

            <div>
              <h4 className="text-[11px] font-bold tracking-[0.22em] text-sage uppercase">
                Keep in mind
              </h4>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                {collegeAid.reminders.map((line) => (
                  <li key={line} className="text-sm text-ink-soft sm:text-base">
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-[11px] font-bold tracking-[0.22em] text-sage uppercase">
                Resources
              </h4>
              <div className="mt-3">
                <ResourceList links={collegeAid.resources} />
              </div>
            </div>
          </div>
        )}

        {tab === 'plan' && (
          <div className="mt-6 space-y-8" role="tabpanel">
            <div>
              <h4 className="text-[11px] font-bold tracking-[0.22em] text-sage uppercase">
                Timeline
              </h4>
              <div className="mt-3">
                <TimelineList rows={collegePlan.timeline} />
              </div>
            </div>

            <div>
              <h4 className="text-[11px] font-bold tracking-[0.22em] text-sage uppercase">
                Keep in mind
              </h4>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                {collegePlan.reminders.map((line) => (
                  <li key={line} className="text-sm text-ink-soft sm:text-base">
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-[11px] font-bold tracking-[0.22em] text-sage uppercase">
                Resources
              </h4>
              <div className="mt-3">
                <ResourceList links={collegePlan.resources} />
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
