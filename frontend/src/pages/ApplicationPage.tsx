import { useEffect, useRef, useState } from 'react'

import {
  applicationItemsProgress,
  newApplicationItem,
} from '../features/opportunities/applicationItems'
import {
  deadlineInputValue,
  deadlineToIso,
  formatDeadline,
  labelStatus,
} from '../features/opportunities/format'
import {
  listOpportunities,
  saveApplicationRecord,
} from '../features/opportunities/opportunityApi'
import { useGroup } from '../features/group/useGroup'
import { useCurrentPerson } from '../features/people/useCurrentPerson'
import {
  TRACKING_STATUSES,
  type ApplicationItem,
  type OpportunityWithTracking,
  type TrackingStatus,
} from '../types/opportunity'

const fieldClass =
  'mt-1 w-full rounded-lg border border-line bg-panel px-3 py-2.5 text-ink outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/25'

const questionClass =
  'w-full border-0 bg-transparent p-0 font-display text-xl font-bold tracking-tight text-ink outline-none placeholder:text-ink-soft/50 focus:ring-0 sm:text-2xl'

const answerClass =
  'mt-3 w-full min-h-40 resize-y rounded-xl border border-line bg-foam/40 px-4 py-3 text-base leading-relaxed text-ink outline-none transition placeholder:text-ink-soft/60 focus:border-sage focus:ring-2 focus:ring-sage/20 sm:min-h-52'

const AUTOSAVE_MS = 5000

type ApplicationPageProps = {
  opportunityId: string
  onBack: () => void
}

export function ApplicationPage({ opportunityId, onBack }: ApplicationPageProps) {
  const { group, loading: groupLoading } = useGroup()
  const { person, loading: personLoading } = useCurrentPerson()

  const [item, setItem] = useState<OpportunityWithTracking | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const [status, setStatus] = useState<TrackingStatus>('saved')
  const [applyUrl, setApplyUrl] = useState('')
  const [docUrl, setDocUrl] = useState('')
  const [submittedAt, setSubmittedAt] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [notes, setNotes] = useState('')
  const [sections, setSections] = useState<ApplicationItem[]>([])

  const readyRef = useRef(false)
  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const draftRef = useRef({
    status: 'saved' as TrackingStatus,
    applyUrl: '',
    docUrl: '',
    submittedAt: '',
    confirmation: '',
    notes: '',
    sections: [] as ApplicationItem[],
  })
  const itemIdRef = useRef<string | null>(null)
  const personIdRef = useRef<string | null>(null)

  useEffect(() => {
    draftRef.current = {
      status,
      applyUrl,
      docUrl,
      submittedAt,
      confirmation,
      notes,
      sections,
    }
  }, [status, applyUrl, docUrl, submittedAt, confirmation, notes, sections])

  useEffect(() => {
    itemIdRef.current = item?.id ?? null
  }, [item])

  useEffect(() => {
    personIdRef.current = person?.id ?? null
  }, [person])

  function markDirty() {
    if (!readyRef.current) return
    dirtyRef.current = true
    setDirty(true)
    setInfo('Unsaved changes…')
  }

  async function persist(reason: 'auto' | 'manual' | 'flush' = 'auto') {
    const opportunityIdToSave = itemIdRef.current
    const personIdToSave = personIdRef.current
    if (!opportunityIdToSave || !personIdToSave) return false
    if (savingRef.current) return false

    savingRef.current = true
    setSaving(true)
    if (reason !== 'flush') {
      setError(null)
      setInfo('Saving…')
    }

    const draft = draftRef.current
    try {
      await saveApplicationRecord(opportunityIdToSave, personIdToSave, {
        status: draft.status,
        apply_url: draft.applyUrl,
        application_doc_url: draft.docUrl,
        submitted_at: deadlineToIso(draft.submittedAt),
        confirmation_code: draft.confirmation,
        application_items: draft.sections,
        notes: draft.notes,
      })
      dirtyRef.current = false
      setDirty(false)
      setInfo(reason === 'auto' ? 'Saved automatically' : 'Saved')
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setInfo(null)
      return false
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    readyRef.current = false

    async function load() {
      if (!group || !person) {
        setLoading(groupLoading || personLoading)
        return
      }
      setLoading(true)
      setError(null)
      setDirty(false)
      dirtyRef.current = false
      try {
        const rows = await listOpportunities(group.id, person.id)
        const found = rows.find((row) => row.id === opportunityId) ?? null
        if (cancelled) return
        if (!found) {
          setError('Opportunity not found')
          setItem(null)
          return
        }
        setItem(found)
        const tracking = found.tracking
        setStatus(tracking?.status ?? 'saved')
        setApplyUrl(tracking?.apply_url ?? '')
        setDocUrl(tracking?.application_doc_url ?? '')
        setSubmittedAt(deadlineInputValue(tracking?.submitted_at ?? null))
        setConfirmation(tracking?.confirmation_code ?? '')
        setNotes(tracking?.notes ?? '')
        const items = tracking?.application_items ?? []
        setSections(items.length > 0 ? items : [newApplicationItem()])
        setInfo(null)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load application')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          // Allow dirty marking after state has settled.
          queueMicrotask(() => {
            if (!cancelled) readyRef.current = true
          })
        }
      }
    }

    void load()
    return () => {
      cancelled = true
      readyRef.current = false
    }
  }, [group, person, groupLoading, personLoading, opportunityId])

  // Debounced autosave while editing.
  useEffect(() => {
    if (!dirty || !readyRef.current) return
    const timer = window.setTimeout(() => {
      void persist('auto')
    }, AUTOSAVE_MS)
    return () => window.clearTimeout(timer)
  }, [dirty, status, applyUrl, docUrl, submittedAt, confirmation, notes, sections])

  // Flush when tab hides (switch apps / close).
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'hidden' && dirtyRef.current) {
        void persist('flush')
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  function updateSection(id: string, patch: Partial<ApplicationItem>) {
    setSections((prev) =>
      prev.map((section) => (section.id === id ? { ...section, ...patch } : section)),
    )
    markDirty()
  }

  function removeSection(id: string) {
    setSections((prev) => {
      const next = prev.filter((section) => section.id !== id)
      return next.length > 0 ? next : [newApplicationItem()]
    })
    markDirty()
  }

  async function handleBack() {
    if (dirtyRef.current) {
      await persist('flush')
    }
    onBack()
  }

  const progress = applicationItemsProgress(sections)
  const saveLabel = saving
    ? 'Saving…'
    : dirty
      ? 'Save now'
      : 'Saved'

  if (loading) {
    return <p className="text-ink-soft">Loading application…</p>
  }

  if (error && !item) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => void handleBack()}
          className="text-sm font-semibold text-sage-deep hover:text-ink"
        >
          ← Opportunities
        </button>
        <p className="font-semibold text-coral" role="alert">
          {error}
        </p>
      </div>
    )
  }

  if (!item) return null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => void handleBack()}
            className="text-sm font-semibold text-sage-deep hover:text-ink"
          >
            ← Opportunities
          </button>
          <p className="mt-3 text-[11px] font-bold tracking-[0.22em] text-sage-deep uppercase">
            Application
          </p>
          <h2 className="mt-1.5 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {item.title}
          </h2>
          {item.organization && (
            <p className="mt-1 text-ink-soft">{item.organization}</p>
          )}
          {progress.total > 0 && (
            <p className="mt-2 text-sm text-ink-soft">
              {progress.done}/{progress.total} prompts marked done
            </p>
          )}
          {info && (
            <p className="mt-2 text-sm font-semibold text-sage-deep" role="status">
              {info}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm">
            <span className="sr-only">Status</span>
            <select
              className="rounded-lg border border-line bg-panel px-3 py-2 text-sm font-semibold text-ink"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as TrackingStatus)
                markDirty()
              }}
            >
              {TRACKING_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {labelStatus(value)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void persist('manual')}
            disabled={saving || !dirty}
            className="btn-primary rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-60"
          >
            {saveLabel}
          </button>
        </div>
      </div>

      <section className="surface-panel space-y-4 rounded-2xl p-5 sm:p-6">
        <h3 className="text-sm font-bold tracking-wide text-ink-soft uppercase">
          Details
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-sm font-semibold text-ink-soft">Apply portal URL</span>
            <input
              className={fieldClass}
              type="url"
              placeholder="https://…"
              value={applyUrl}
              onChange={(event) => {
                setApplyUrl(event.target.value)
                markDirty()
              }}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-semibold text-ink-soft">
              Optional draft doc link
            </span>
            <input
              className={fieldClass}
              type="url"
              placeholder="Google Doc or Word Online (optional)"
              value={docUrl}
              onChange={(event) => {
                setDocUrl(event.target.value)
                markDirty()
              }}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-ink-soft">Submitted</span>
            <input
              className={fieldClass}
              type="date"
              value={submittedAt}
              onChange={(event) => {
                setSubmittedAt(event.target.value)
                markDirty()
              }}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-ink-soft">Confirmation #</span>
            <input
              className={fieldClass}
              value={confirmation}
              onChange={(event) => {
                setConfirmation(event.target.value)
                markDirty()
              }}
              placeholder="Portal receipt"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-semibold text-ink-soft">Notes</span>
            <textarea
              className={`${fieldClass} min-h-16`}
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value)
                markDirty()
              }}
              spellCheck
            />
          </label>
        </div>
        {item.tracking?.submitted_at && !submittedAt && (
          <p className="text-sm text-ink-soft">
            Previously recorded: {formatDeadline(item.tracking.submitted_at)}
          </p>
        )}
      </section>

      <div className="space-y-8">
        {sections.map((section, index) => (
          <section
            key={section.id}
            className="surface-panel rounded-2xl p-5 sm:p-7"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] font-bold tracking-[0.18em] text-ink-soft uppercase">
                Question {index + 1}
              </p>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-ink-soft">
                  <input
                    type="checkbox"
                    checked={section.done}
                    onChange={(event) =>
                      updateSection(section.id, { done: event.target.checked })
                    }
                  />
                  Done
                </label>
                <button
                  type="button"
                  onClick={() => removeSection(section.id)}
                  className="text-sm font-semibold text-coral hover:text-ink"
                >
                  Remove
                </button>
              </div>
            </div>
            <input
              className={`${questionClass} mt-2`}
              value={section.question}
              onChange={(event) =>
                updateSection(section.id, { question: event.target.value })
              }
              placeholder="Application question…"
              spellCheck
            />
            <textarea
              className={answerClass}
              value={section.answer}
              onChange={(event) =>
                updateSection(section.id, { answer: event.target.value })
              }
              placeholder="Write your answer…"
              spellCheck
            />
          </section>
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          setSections((prev) => [...prev, newApplicationItem()])
          markDirty()
        }}
        className="text-sm font-bold text-sage hover:text-ink"
      >
        + Add question
      </button>

      {error && (
        <p className="text-sm font-semibold text-coral" role="alert">
          {error}
        </p>
      )}

      <div className="pb-8">
        <button
          type="button"
          onClick={() => void persist('manual')}
          disabled={saving || !dirty}
          className="btn-primary rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-60"
        >
          {saveLabel}
        </button>
      </div>
    </div>
  )
}
