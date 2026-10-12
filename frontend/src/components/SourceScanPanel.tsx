import { useEffect, useState } from 'react'

import { useAuth } from '../features/auth/AuthProvider'
import { deadlineToIso } from '../features/opportunities/format'
import {
  fetchCuratedSources,
  scanCuratedSources,
  type CuratedSource,
  type ScanProposal,
  type ScanResponse,
} from '../lib/api'
import type { OpportunityInput } from '../types/opportunity'

type SourceScanPanelProps = {
  onAddMany: (inputs: OpportunityInput[]) => Promise<{ error: string | null }>
}

export function SourceScanPanel({ onAddMany }: SourceScanPanelProps) {
  const { session } = useAuth()
  const [sources, setSources] = useState<CuratedSource[]>([])
  const [llmEnabled, setLlmEnabled] = useState(false)
  const [proposals, setProposals] = useState<ScanProposal[]>([])
  const [errors, setErrors] = useState<ScanResponse['errors']>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loadingSources, setLoadingSources] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.access_token) return
    let cancelled = false
    void (async () => {
      setLoadingSources(true)
      try {
        const result = await fetchCuratedSources(session.access_token)
        if (cancelled) return
        setSources(result.sources ?? [])
        setLlmEnabled(Boolean(result.llm_enabled))
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load sources')
        }
      } finally {
        if (!cancelled) setLoadingSources(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session?.access_token])

  async function handleScan() {
    if (!session?.access_token) {
      setError('Sign in to scan sources')
      return
    }
    setError(null)
    setInfo(null)
    setScanning(true)
    try {
      const result = await scanCuratedSources(session.access_token)
      setProposals(result.proposals)
      setErrors(result.errors)
      setSelected(new Set(result.proposals.map((item) => item.key)))
      setInfo(
        result.proposals.length
          ? `Found ${result.proposals.length} proposal${result.proposals.length === 1 ? '' : 's'}${
              result.llm_used ? ' (AI extract)' : ' (rules extract)'
            }. Review and add.`
          : 'Scan finished — no proposals returned.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleAddSelected() {
    const chosen = proposals.filter((item) => selected.has(item.key))
    if (chosen.length === 0) {
      setError('Select at least one proposal')
      return
    }
    setSaving(true)
    setError(null)
    const inputs: OpportunityInput[] = chosen.map((item) => {
      const notes = [item.application_timing?.trim()].filter(Boolean).join('\n')
      return {
        title: item.title,
        organization: item.organization ?? undefined,
        opportunity_type: 'program',
        timing_kind: item.timing_kind ?? 'other',
        description: item.description ?? undefined,
        location: item.location ?? 'Chicago, IL',
        source_url: item.item_url || item.source_url,
        opens_at: deadlineToIso(item.opens_date ?? ''),
        deadline_at: deadlineToIso(item.deadline_date ?? ''),
        eligibility: item.eligibility ?? undefined,
        status: 'saved',
        notes: notes || undefined,
      }
    })
    const result = await onAddMany(inputs)
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setInfo(`Added ${chosen.length} opportunit${chosen.length === 1 ? 'y' : 'ies'}.`)
    setProposals((prev) => prev.filter((item) => !selected.has(item.key)))
    setSelected(new Set())
  }

  return (
    <section className="surface-panel rounded-2xl p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-xl font-bold text-ink">Scan sources</h3>
          <p className="mt-1 max-w-xl text-sm text-ink-soft">
            Fetch your curated Chicago STEM pages and propose opportunities to
            review. {llmEnabled ? 'AI extract is on.' : 'Add OPENAI_API_KEY for AI extract (rules still work).'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleScan()}
          disabled={scanning || loadingSources}
          className="btn-primary rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-60"
        >
          {scanning ? 'Scanning…' : 'Scan sources'}
        </button>
      </div>

      {loadingSources ? (
        <p className="mt-4 text-sm text-ink-soft">Loading source list…</p>
      ) : (
        <ul className="mt-4 space-y-1 text-sm text-ink-soft">
          {sources.map((source) => (
            <li key={source.id}>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-sage-deep hover:text-ink"
              >
                {source.name}
              </a>
            </li>
          ))}
        </ul>
      )}

      {info && (
        <p className="mt-4 text-sm font-semibold text-sage-deep" role="status">
          {info}
        </p>
      )}

      {error && (
        <p className="mt-4 text-sm font-semibold text-coral" role="alert">
          {error}
        </p>
      )}

      {errors.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-ink-soft">
          {errors.map((item) => (
            <li key={item.source_id}>
              Could not scan {item.source_name}: {item.detail}
            </li>
          ))}
        </ul>
      )}

      {proposals.length > 0 && (
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink-soft">
              {selected.size} of {proposals.length} selected
            </p>
            <div className="flex gap-2 text-sm">
              <button
                type="button"
                className="font-semibold text-sage-deep hover:text-ink"
                onClick={() =>
                  setSelected(new Set(proposals.map((item) => item.key)))
                }
              >
                Select all
              </button>
              <button
                type="button"
                className="font-semibold text-ink-soft hover:text-ink"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </button>
            </div>
          </div>

          <ul className="max-h-96 space-y-2 overflow-y-auto border-y border-line py-2">
            {proposals.map((item) => (
              <li key={item.key}>
                <label className="flex cursor-pointer gap-3 rounded-lg px-2 py-2 transition hover:bg-ink/5">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selected.has(item.key)}
                    onChange={() => toggle(item.key)}
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{item.title}</span>
                    <span className="mt-0.5 block text-xs text-ink-soft">
                      {[
                        item.timing_kind === 'summer'
                          ? 'Summer'
                          : item.timing_kind === 'ongoing'
                            ? 'Ongoing'
                            : null,
                        item.source_name,
                        item.organization,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    {(item.opens_date || item.deadline_date) && (
                      <span className="mt-1 block text-sm font-semibold text-ink">
                        {[
                          item.opens_date && `Opens ${item.opens_date}`,
                          item.deadline_date && `Deadline ${item.deadline_date}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    )}
                    {item.application_timing && (
                      <span className="mt-1 block text-sm text-ink">
                        Timeline: {item.application_timing}
                      </span>
                    )}
                    {!item.opens_date &&
                      !item.deadline_date &&
                      !item.application_timing && (
                        <span className="mt-1 block text-xs text-ink-soft">
                          No open/deadline dates found on page
                        </span>
                      )}
                    {item.description && (
                      <span className="mt-1 block text-sm text-ink-soft line-clamp-2">
                        {item.description}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <button
            type="button"
            disabled={saving || selected.size === 0}
            onClick={() => void handleAddSelected()}
            className="btn-primary rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-60"
          >
            {saving
              ? 'Adding…'
              : `Add ${selected.size} opportunit${selected.size === 1 ? 'y' : 'ies'}`}
          </button>
        </div>
      )}
    </section>
  )
}
