import { useState, type FormEvent } from 'react'

import { useAuth } from '../features/auth/AuthProvider'
import { deadlineInputValue, deadlineToIso } from '../features/opportunities/format'
import { extractFromUrl, type ExtractCandidate } from '../lib/api'
import {
  OPPORTUNITY_TYPES,
  TIMING_KINDS,
  TRACKING_STATUSES,
  type OpportunityInput,
  type OpportunityType,
  type OpportunityWithTracking,
  type TrackingStatus,
} from '../types/opportunity'

const fieldClass =
  'mt-1 w-full rounded-lg border border-line bg-panel px-3 py-2.5 text-ink outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/25'

type OpportunityFormProps = {
  initial?: OpportunityWithTracking | null
  submitting?: boolean
  onSubmit: (
    input: OpportunityInput | OpportunityInput[],
  ) => Promise<{ error: string | null }>
  onCancel?: () => void
}

export function OpportunityForm({
  initial,
  submitting = false,
  onSubmit,
  onCancel,
}: OpportunityFormProps) {
  const { session } = useAuth()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [organization, setOrganization] = useState(initial?.organization ?? '')
  const [opportunityType, setOpportunityType] = useState<OpportunityType>(
    initial?.opportunity_type ?? 'program',
  )
  const [timingKind, setTimingKind] = useState<'summer' | 'ongoing'>(
    initial?.timing_kind === 'summer' ? 'summer' : 'ongoing',
  )
  const [sourceUrl, setSourceUrl] = useState(initial?.source_url ?? '')
  const [opens, setOpens] = useState(deadlineInputValue(initial?.opens_at ?? null))
  const [deadline, setDeadline] = useState(deadlineInputValue(initial?.deadline_at ?? null))
  const [location, setLocation] = useState(initial?.location ?? 'Chicago, IL')
  const [eligibility, setEligibility] = useState(initial?.eligibility ?? '')
  const [status, setStatus] = useState<TrackingStatus>(
    initial?.tracking?.status ?? 'saved',
  )
  const [notes, setNotes] = useState(initial?.tracking?.notes ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [info, setInfo] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [candidates, setCandidates] = useState<ExtractCandidate[]>([])
  const [selectedTitles, setSelectedTitles] = useState<Set<string>>(new Set())

  const multiMode = !initial && candidates.length > 1
  const selectedCount = selectedTitles.size

  function toggleCandidate(titleValue: string) {
    setSelectedTitles((prev) => {
      const next = new Set(prev)
      if (next.has(titleValue)) next.delete(titleValue)
      else next.add(titleValue)
      return next
    })
  }

  function selectAllCandidates() {
    setSelectedTitles(new Set(candidates.map((item) => item.title)))
  }

  function clearCandidateSelection() {
    setSelectedTitles(new Set())
  }

  async function handleExtract() {
    setError(null)
    setWarnings([])
    setInfo(null)
    setCandidates([])
    setSelectedTitles(new Set())

    if (!sourceUrl.trim()) {
      setError('Paste a URL first')
      return
    }
    if (!session?.access_token) {
      setError('You must be signed in to pull page details')
      return
    }

    setExtracting(true)
    try {
      const extracted = await extractFromUrl(sourceUrl.trim(), session.access_token)
      setSourceUrl(extracted.source_url)
      if (extracted.organization) setOrganization(extracted.organization)
      if (extracted.location) setLocation(extracted.location)

      const nextCandidates = extracted.candidates ?? []
      setCandidates(nextCandidates)
      setWarnings(extracted.warnings)

      if (nextCandidates.length > 1) {
        setSelectedTitles(new Set(nextCandidates.map((item) => item.title)))
        setInfo(
          `Found ${nextCandidates.length} programs. Select which to add, then save.`,
        )
      } else {
        if (extracted.title) setTitle(extracted.title)
        if (extracted.description) setDescription(extracted.description)
        const opensDate = nextCandidates[0]?.opens_date ?? extracted.opens_date
        if (opensDate) setOpens(opensDate)
        if (extracted.deadline_date) setDeadline(extracted.deadline_date)
        if (extracted.eligibility) setEligibility(extracted.eligibility)
        const kind =
          nextCandidates[0]?.timing_kind ?? extracted.timing_kind
        if (kind === 'summer') setTimingKind('summer')
        else if (kind) setTimingKind('ongoing')
        const timing =
          nextCandidates[0]?.application_timing ?? extracted.application_timing
        if (timing && !notes.trim()) {
          setNotes(timing)
        }
        if (nextCandidates.length === 1) {
          setSelectedTitles(new Set([nextCandidates[0].title]))
        }

        const filled = [
          extracted.title && 'title',
          extracted.organization && 'organization',
          opensDate && 'opens',
          extracted.deadline_date && 'deadline',
          timing && 'application timing',
          extracted.description && 'description',
        ].filter(Boolean)
        setInfo(
          filled.length
            ? `Pulled from page: ${filled.join(', ')}. Review and save.`
            : 'Page fetched, but little detail was found. Fill fields manually.',
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not pull details from URL')
    } finally {
      setExtracting(false)
    }
  }

  function buildSharedFields(): Pick<
    OpportunityInput,
    | 'organization'
    | 'opportunity_type'
    | 'timing_kind'
    | 'source_url'
    | 'location'
    | 'status'
    | 'notes'
  > {
    return {
      organization,
      opportunity_type: opportunityType,
      timing_kind: timingKind,
      source_url: sourceUrl,
      location,
      status,
      notes,
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (multiMode) {
      const chosen = candidates.filter((item) => selectedTitles.has(item.title))
      if (chosen.length === 0) {
        setError('Select at least one program to add')
        return
      }

      const shared = buildSharedFields()
      const inputs: OpportunityInput[] = chosen.map((candidate) => {
        const timingNote = candidate.application_timing?.trim()
        const mergedNotes = [shared.notes?.trim(), timingNote]
          .filter(Boolean)
          .join('\n')
        return {
          ...shared,
          title: candidate.title,
          description: candidate.description ?? undefined,
          opens_at: deadlineToIso(candidate.opens_date ?? ''),
          deadline_at: deadlineToIso(candidate.deadline_date ?? ''),
          timing_kind:
            candidate.timing_kind === 'summer'
              ? 'summer'
              : (shared.timing_kind ?? 'ongoing'),
          eligibility: candidate.eligibility ?? undefined,
          location: candidate.location || shared.location,
          source_url: candidate.source_url || shared.source_url,
          notes: mergedNotes || undefined,
        }
      })

      const result = await onSubmit(inputs)
      if (result.error) setError(result.error)
      return
    }

    const result = await onSubmit({
      title,
      organization,
      opportunity_type: opportunityType,
      timing_kind: timingKind,
      source_url: sourceUrl,
      opens_at: deadlineToIso(opens),
      deadline_at: deadlineToIso(deadline),
      location,
      eligibility,
      status,
      notes,
      description,
    })

    if (result.error) {
      setError(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <span className="text-sm font-semibold text-ink-soft">Source URL</span>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <input
            className={`${fieldClass} mt-0 min-w-0 flex-1`}
            type="url"
            placeholder="https://museum-or-university-program-page…"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
          />
          <button
            type="button"
            onClick={() => void handleExtract()}
            disabled={extracting || !sourceUrl.trim()}
            className="btn-primary rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-60"
          >
            {extracting ? 'Pulling…' : 'Pull details'}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-ink-soft">
          Fetches that one page. If it lists several programs, you can add many at once.
        </p>
      </div>

      {multiMode && (
        <fieldset className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <legend className="text-sm font-semibold text-ink-soft">
              Programs on this page ({selectedCount} selected)
            </legend>
            <div className="flex gap-2 text-sm">
              <button
                type="button"
                onClick={selectAllCandidates}
                className="font-semibold text-sage-deep hover:text-ink"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={clearCandidateSelection}
                className="font-semibold text-ink-soft hover:text-ink"
              >
                Clear
              </button>
            </div>
          </div>
          <ul className="max-h-72 space-y-2 overflow-y-auto border-y border-line py-2">
            {candidates.map((candidate) => {
              const checked = selectedTitles.has(candidate.title)
              return (
                <li key={candidate.title}>
                  <label className="flex cursor-pointer gap-3 rounded-lg px-2 py-2 transition hover:bg-ink/5">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={checked}
                      onChange={() => toggleCandidate(candidate.title)}
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink">
                        {candidate.title}
                      </span>
                      {(candidate.deadline_date ||
                        candidate.application_timing ||
                        candidate.eligibility) && (
                        <span className="mt-0.5 block text-xs text-ink-soft">
                          {[
                            candidate.deadline_date &&
                              `Deadline ${candidate.deadline_date}`,
                            !candidate.deadline_date &&
                              candidate.application_timing,
                            candidate.eligibility,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                      {candidate.description && (
                        <span className="mt-1 block text-sm text-ink-soft line-clamp-2">
                          {candidate.description}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </fieldset>
      )}

      {!multiMode && (
        <label className="block">
          <span className="text-sm font-semibold text-ink-soft">Title</span>
          <input
            className={fieldClass}
            required={!sourceUrl.trim()}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Program or internship name"
          />
        </label>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="text-sm font-semibold text-ink-soft">Organization</span>
          <input
            className={fieldClass}
            value={organization}
            onChange={(event) => setOrganization(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-ink-soft">Type</span>
          <select
            className={fieldClass}
            value={opportunityType}
            onChange={(event) =>
              setOpportunityType(event.target.value as OpportunityType)
            }
          >
            {OPPORTUNITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-ink-soft">When it runs</span>
          <select
            className={fieldClass}
            value={timingKind}
            onChange={(event) =>
              setTimingKind(event.target.value === 'summer' ? 'summer' : 'ongoing')
            }
          >
            {TIMING_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind === 'summer' ? 'Summer' : 'Ongoing / year-round'}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!multiMode && (
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm font-semibold text-ink-soft">Applications open</span>
            <input
              className={fieldClass}
              type="date"
              value={opens}
              onChange={(event) => setOpens(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-ink-soft">Deadline</span>
            <input
              className={fieldClass}
              type="date"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-ink-soft">Your status</span>
            <select
              className={fieldClass}
              value={status}
              onChange={(event) => setStatus(event.target.value as TrackingStatus)}
            >
              {TRACKING_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {multiMode && (
        <label className="block">
          <span className="text-sm font-semibold text-ink-soft">Status for all</span>
          <select
            className={fieldClass}
            value={status}
            onChange={(event) => setStatus(event.target.value as TrackingStatus)}
          >
            {TRACKING_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-ink-soft">
            {multiMode ? 'Default location' : 'Location'}
          </span>
          <input
            className={fieldClass}
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
        </label>
        {!multiMode && (
          <label className="block">
            <span className="text-sm font-semibold text-ink-soft">Eligibility</span>
            <input
              className={fieldClass}
              value={eligibility}
              onChange={(event) => setEligibility(event.target.value)}
              placeholder="Grade, age, etc."
            />
          </label>
        )}
      </div>

      <label className="block">
        <span className="text-sm font-semibold text-ink-soft">
          {multiMode ? 'Notes for all' : 'Notes'}
        </span>
        <textarea
          className={`${fieldClass} min-h-20`}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>

      {!multiMode && (
        <label className="block">
          <span className="text-sm font-semibold text-ink-soft">Description</span>
          <textarea
            className={`${fieldClass} min-h-20`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
      )}

      {info && (
        <p className="text-sm font-semibold text-sage-deep" role="status">
          {info}
        </p>
      )}

      {warnings.length > 0 && (
        <ul className="space-y-1 text-sm text-ink-soft" role="status">
          {warnings.map((warning) => (
            <li key={warning}>• {warning}</li>
          ))}
        </ul>
      )}

      {error && (
        <p className="text-sm font-semibold text-coral" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={submitting || (multiMode && selectedCount === 0)}
          className="btn-primary rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-60"
        >
          {submitting
            ? 'Saving…'
            : initial
              ? 'Save changes'
              : multiMode
                ? `Add ${selectedCount} opportunit${selectedCount === 1 ? 'y' : 'ies'}`
                : 'Add opportunity'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-ink-soft transition hover:bg-ink/5"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
