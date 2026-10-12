import { useState } from 'react'

import { OpportunityForm } from '../components/OpportunityForm'
import { SourceScanPanel } from '../components/SourceScanPanel'
import {
  formatDeadline,
  labelStatus,
  labelTimingKind,
  labelType,
} from '../features/opportunities/format'
import { useOpportunities } from '../features/opportunities/useOpportunities'
import type {
  OpportunityFilter,
  OpportunityWithTracking,
  TrackingStatus,
} from '../types/opportunity'

const filters: { id: OpportunityFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'summer', label: 'Summer' },
  { id: 'ongoing', label: 'Ongoing' },
  { id: 'due_soon', label: 'Due soon' },
  { id: 'open', label: 'Open' },
  { id: 'saved', label: 'Saved' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'past', label: 'Past' },
]

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'source page'
  }
}

export function OpportunitiesPage() {
  const {
    items,
    allCount,
    filter,
    setFilter,
    loading,
    error,
    add,
    save,
    setStatus,
    remove,
  } = useOpportunities()

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<OpportunityWithTracking | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [formBusy, setFormBusy] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.22em] text-sage-deep uppercase">
            Tracker
          </p>
          <h2 className="mt-1.5 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Opportunities
          </h2>
          <p className="mt-2 max-w-xl text-sm text-ink-soft sm:text-base">
            {import.meta.env.DEV
              ? 'Scan curated Chicago STEM pages, paste a URL, or add by hand.'
              : 'Paste a URL or add by hand. Track status and deadlines here.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null)
            setShowForm(true)
          }}
          className="btn-primary rounded-xl px-4 py-2.5 text-sm font-bold"
        >
          Add opportunity
        </button>
      </div>

      {import.meta.env.DEV && <SourceScanPanel onAddMany={add} />}

      <div className="flex flex-wrap gap-1.5">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`filter-chip rounded-lg px-3 py-1.5 text-sm font-semibold ${
              filter === item.id
                ? 'bg-ink text-foam'
                : 'bg-white text-ink-soft ring-1 ring-line hover:text-ink'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {(showForm || editing) && (
        <section className="surface-panel animate-pop-in rounded-2xl p-5 sm:p-7">
          <h3 className="font-display text-xl font-bold text-ink">
            {editing ? 'Edit opportunity' : 'New opportunity'}
          </h3>
          <p className="mt-1 text-sm text-ink-soft">
            Paste a URL to pull one program or several from a listing page.
          </p>
          <div className="mt-5">
            <OpportunityForm
              key={editing?.id ?? 'new'}
              initial={editing}
              submitting={formBusy}
              onCancel={() => {
                setShowForm(false)
                setEditing(null)
              }}
              onSubmit={async (input) => {
                setFormBusy(true)
                let result: { error: string | null }
                if (editing) {
                  if (Array.isArray(input)) {
                    setFormBusy(false)
                    return { error: 'Cannot bulk-edit from this form' }
                  }
                  result = await save(editing.id, input)
                } else {
                  result = await add(input)
                }
                setFormBusy(false)
                if (!result.error) {
                  setShowForm(false)
                  setEditing(null)
                }
                return result
              }}
            />
          </div>
        </section>
      )}

      {loading && (
        <p className="text-ink-soft">Loading opportunities…</p>
      )}

      {error && (
        <p className="font-semibold text-coral" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && items.length === 0 && (
        <section className="surface-panel rounded-2xl p-8">
          <h3 className="font-display text-xl font-extrabold text-ink">
            {allCount === 0 ? 'No opportunities yet' : 'Nothing in this filter'}
          </h3>
          <p className="mt-2 text-ink-soft">
            {allCount === 0
              ? 'Add a summer program, internship, or museum opportunity to get started.'
              : 'Try another filter, or add a new opportunity.'}
          </p>
        </section>
      )}

      <ul className="space-y-2">
        {items.map((item) => {
          const status = item.tracking?.status ?? 'saved'
          return (
            <li
              key={item.id}
              className="list-row animate-pop-in rounded-2xl border border-line bg-white/80 px-4 py-4 sm:px-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold tracking-wide text-sage-deep uppercase">
                    <span className="rounded-md bg-mist px-1.5 py-0.5">
                      {labelTimingKind(item.timing_kind)}
                    </span>
                    <span>{labelType(item.opportunity_type)}</span>
                  </div>
                  <h3 className="mt-2 font-display text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-ink-soft">
                    {[item.organization, item.location].filter(Boolean).join(' · ')}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {[
                      item.opens_at && `Opens: ${formatDeadline(item.opens_at)}`,
                      `Deadline: ${formatDeadline(item.deadline_at)}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {item.source_url && (
                    <p className="mt-2 text-sm text-ink-soft">
                      From{' '}
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-sage-deep hover:text-ink"
                      >
                        {hostFromUrl(item.source_url)}
                      </a>
                      <span className="text-line"> · </span>
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-sage-deep hover:text-ink"
                      >
                        Open page
                      </a>
                    </p>
                  )}
                  {item.tracking?.notes && (
                    <p className="mt-2 text-sm text-ink-soft">{item.tracking.notes}</p>
                  )}
                </div>

                <div className="flex flex-col items-stretch gap-2 sm:items-end">
                  <label className="text-sm">
                    <span className="sr-only">Status</span>
                    <select
                      className="rounded-lg border border-line bg-foam px-3 py-2 text-sm font-semibold text-ink"
                      value={status}
                      disabled={busyId === item.id}
                      onChange={async (event) => {
                        setBusyId(item.id)
                        await setStatus(
                          item.id,
                          event.target.value as TrackingStatus,
                        )
                        setBusyId(null)
                      }}
                    >
                      {(
                        [
                          'saved',
                          'in_progress',
                          'submitted',
                          'accepted',
                          'declined',
                          'withdrawn',
                        ] as TrackingStatus[]
                      ).map((value) => (
                        <option key={value} value={value}>
                          {labelStatus(value)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-lg px-3 py-2 text-sm font-semibold text-sage-deep hover:bg-sage/15"
                      onClick={() => {
                        setShowForm(false)
                        setEditing(item)
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded-lg px-3 py-2 text-sm font-semibold text-coral hover:bg-coral/10"
                      disabled={busyId === item.id}
                      onClick={async () => {
                        if (!confirm(`Delete “${item.title}”?`)) return
                        setBusyId(item.id)
                        await remove(item.id)
                        setBusyId(null)
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
