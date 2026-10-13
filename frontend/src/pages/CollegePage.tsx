import { useState, type FormEvent } from 'react'

import {
  collegeAid,
  collegeComingUp,
  collegePlan,
  type ResourceLink,
  type TimelineRow,
} from '../features/college/seed'
import { useCollegeTargets } from '../features/college/useCollegeTargets'
import {
  COLLEGE_BANDS,
  labelCollegeBand,
  type CollegeBand,
} from '../types/college'

type CollegeTab = 'coming' | 'aid' | 'plan' | 'list'

const tabs: { id: CollegeTab; label: string }[] = [
  { id: 'coming', label: 'Coming up' },
  { id: 'aid', label: 'Aid' },
  { id: 'plan', label: 'Plan' },
  { id: 'list', label: 'Colleges' },
]

const fieldClass =
  'mt-1 w-full rounded-lg border border-line bg-panel px-3 py-2.5 text-ink outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/25'

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

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'link'
  }
}

export function CollegePage() {
  const [tab, setTab] = useState<CollegeTab>('coming')
  const { items, loading, error, add, remove } = useCollegeTargets()

  const [name, setName] = useState('')
  const [band, setBand] = useState<CollegeBand>('target')
  const [sourceUrl, setSourceUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    setSaving(true)
    const result = await add({
      name,
      band,
      source_url: sourceUrl,
      notes,
    })
    setSaving(false)
    if (result.error) {
      setFormError(result.error)
      return
    }
    setName('')
    setBand('target')
    setSourceUrl('')
    setNotes('')
  }

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

        {tab === 'list' && (
          <div className="mt-6 space-y-8" role="tabpanel">
            <form onSubmit={(event) => void handleAdd(event)} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="text-sm font-semibold text-ink-soft">College</span>
                  <input
                    className={fieldClass}
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="School name"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-ink-soft">Band</span>
                  <select
                    className={fieldClass}
                    value={band}
                    onChange={(event) =>
                      setBand(event.target.value as CollegeBand)
                    }
                  >
                    {COLLEGE_BANDS.map((value) => (
                      <option key={value} value={value}>
                        {labelCollegeBand(value)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-ink-soft">Link</span>
                  <input
                    className={fieldClass}
                    type="url"
                    value={sourceUrl}
                    onChange={(event) => setSourceUrl(event.target.value)}
                    placeholder="https://"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-sm font-semibold text-ink-soft">Notes</span>
                  <input
                    className={fieldClass}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Optional"
                  />
                </label>
              </div>
              {formError && (
                <p className="text-sm font-semibold text-coral" role="alert">
                  {formError}
                </p>
              )}
              <button
                type="submit"
                disabled={saving}
                className="btn-primary rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-60"
              >
                {saving ? 'Adding…' : 'Add college'}
              </button>
            </form>

            {loading && <p className="text-ink-soft">Loading…</p>}
            {error && (
              <p className="font-semibold text-coral" role="alert">
                {error}
              </p>
            )}

            {!loading && !error && items.length === 0 && (
              <p className="text-ink-soft">No colleges yet.</p>
            )}

            <ul className="divide-y divide-line border-y border-line">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-4"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold tracking-wide text-sage uppercase">
                      {labelCollegeBand(item.band)}
                    </p>
                    <h3 className="mt-1 font-display text-xl font-bold text-ink">
                      {item.name}
                    </h3>
                    {item.source_url && (
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-sm font-semibold text-sage hover:text-ink"
                      >
                        {hostFromUrl(item.source_url)}
                      </a>
                    )}
                    {item.notes && (
                      <p className="mt-1 text-sm text-ink-soft">{item.notes}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-coral hover:bg-coral/10"
                    disabled={busyId === item.id}
                    onClick={async () => {
                      if (!confirm(`Delete “${item.name}”?`)) return
                      setBusyId(item.id)
                      const result = await remove(item.id)
                      setBusyId(null)
                      if (result.error) setFormError(result.error)
                    }}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
