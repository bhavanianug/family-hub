import { useMemo, useState, type ReactNode } from 'react'

import { useAuth } from '../features/auth/AuthProvider'
import {
  DEFAULT_DISCOVER_FILTERS,
  INTEREST_OPTIONS,
  WHEN_OPTIONS,
  WHO_OPTIONS,
  buildDiscoverQuery,
  type DiscoverFilters,
  type DiscoverInterest,
  type DiscoverWhen,
  type DiscoverWho,
} from '../features/discover/buildDiscoverQuery'
import { mergeDiscoverResults } from '../features/discover/mergeDiscoverResults'
import {
  rankDiscoverHits,
  type RankedDiscoverHit,
} from '../features/discover/rankDiscoverHits'
import { opportunityInputsFromExtract } from '../features/opportunities/fromExtract'
import { discoverOpportunitiesPoc, extractFromUrl } from '../lib/api'
import type { OpportunityInput } from '../types/opportunity'

type DiscoverPocPanelProps = {
  onAddLink: (
    input: OpportunityInput | OpportunityInput[],
  ) => Promise<{ error: string | null }>
  onOpenOpportunities?: () => void
}

export function DiscoverPocPanel({
  onAddLink,
  onOpenOpportunities,
}: DiscoverPocPanelProps) {
  const { session } = useAuth()
  const [filters, setFilters] = useState<DiscoverFilters>(
    DEFAULT_DISCOVER_FILTERS,
  )
  const [usedQuery, setUsedQuery] = useState<string | null>(null)
  const [engines, setEngines] = useState<
    Awaited<ReturnType<typeof discoverOpportunitiesPoc>>['engines']
  >([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [addingUrl, setAddingUrl] = useState<string | null>(null)
  const [addedUrls, setAddedUrls] = useState<Set<string>>(() => new Set())

  const builtQuery = buildDiscoverQuery(filters)
  const canSearch = Boolean(builtQuery) && !searching
  const hits = useMemo(
    () => rankDiscoverHits(mergeDiscoverResults(engines), filters),
    [engines, filters],
  )

  async function handleDiscover() {
    if (!session?.access_token) {
      setError('Sign in to run Discover')
      return
    }
    const query = buildDiscoverQuery(filters)
    if (!query) {
      setError('Pick an interest and a when / type')
      return
    }
    setError(null)
    setInfo(null)
    setSearching(true)
    try {
      const result = await discoverOpportunitiesPoc(
        session.access_token,
        query,
        'both',
      )
      setUsedQuery(result.query)
      setEngines(result.engines ?? [])
    } catch (err) {
      setEngines([])
      setError(err instanceof Error ? err.message : 'Discover failed')
    } finally {
      setSearching(false)
    }
  }

  async function handleAddLink(hit: RankedDiscoverHit) {
    if (!session?.access_token) {
      setError('Sign in to add to Opportunities')
      return
    }
    setError(null)
    setInfo(null)
    setAddingUrl(hit.url)
    const timingKind = filters.when === 'summer' ? 'summer' : 'ongoing'
    const fallback = {
      title: hit.title,
      location: filters.where.trim() || 'Chicago, IL',
      timing_kind: timingKind as 'summer' | 'ongoing',
      description: hit.description ?? undefined,
    }

    try {
      // Same extract path as Opportunities → Pull details.
      const extracted = await extractFromUrl(hit.url, session.access_token)
      const inputs = opportunityInputsFromExtract(extracted, fallback)
      const result = await onAddLink(inputs.length === 1 ? inputs[0]! : inputs)
      if (result.error) {
        setError(result.error)
        return
      }
      setAddedUrls((prev) => new Set(prev).add(hit.url))
      const label = inputs[0]?.title ?? hit.title
      setInfo(
        inputs.length > 1
          ? `Pulled details and saved ${inputs.length} programs to Opportunities.`
          : `Pulled details and saved “${label}” to Opportunities.`,
      )
    } catch (err) {
      // Fall back to title + URL if the page cannot be extracted.
      const result = await onAddLink({
        title: fallback.title,
        opportunity_type: 'program',
        timing_kind: fallback.timing_kind,
        description: fallback.description,
        location: fallback.location,
        source_url: hit.url,
        status: 'saved',
      })
      if (result.error) {
        setError(result.error)
        return
      }
      setAddedUrls((prev) => new Set(prev).add(hit.url))
      setInfo(
        `Saved “${hit.title}” with link only — could not pull page details (${
          err instanceof Error ? err.message : 'extract failed'
        }).`,
      )
    } finally {
      setAddingUrl(null)
    }
  }

  return (
    <section className="surface-panel rounded-2xl p-5 sm:p-7">
      <FilterRow label="Who">
        {WHO_OPTIONS.map((item) => (
          <Chip
            key={item.id}
            label={item.label}
            active={filters.who === item.id}
            onClick={() =>
              setFilters((prev) => ({ ...prev, who: item.id as DiscoverWho }))
            }
          />
        ))}
      </FilterRow>

      <label className="mt-4 block max-w-sm">
        <span className="text-xs font-bold tracking-wide text-ink-soft uppercase">
          Where
        </span>
        <input
          className="mt-2 w-full rounded-lg border border-line bg-panel px-3 py-2.5 text-ink outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/25"
          value={filters.where}
          onChange={(event) =>
            setFilters((prev) => ({ ...prev, where: event.target.value }))
          }
          placeholder="Chicago"
        />
        <span className="mt-1 block text-xs text-ink-soft">
          US location only — city, metro, state, or “US remote”.
        </span>
      </label>

      <label className="mt-4 block max-w-sm">
        <span className="text-xs font-bold tracking-wide text-ink-soft uppercase">
          Interest
        </span>
        <select
          className="mt-2 w-full rounded-lg border border-line bg-panel px-3 py-2.5 text-sm font-semibold text-ink outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/25"
          value={filters.interest ?? ''}
          onChange={(event) =>
            setFilters((prev) => ({
              ...prev,
              interest: (event.target.value || null) as DiscoverInterest | null,
            }))
          }
        >
          <option value="">Select interest</option>
          {INTEREST_OPTIONS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <FilterRow label="When / type" className="mt-4">
        {WHEN_OPTIONS.map((item) => (
          <Chip
            key={item.id}
            label={item.label}
            active={filters.when === item.id}
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                when: item.id as DiscoverWhen,
              }))
            }
          />
        ))}
      </FilterRow>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="min-w-0">
          <span className="text-sm font-semibold text-ink-soft">
            Orgs (optional)
          </span>
          <input
            className="mt-1 w-full rounded-lg border border-line bg-panel px-3 py-2.5 text-ink outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/25"
            value={filters.orgs}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, orgs: event.target.value }))
            }
            placeholder="Argonne, Fermilab"
          />
        </label>
        <label className="min-w-0">
          <span className="text-sm font-semibold text-ink-soft">
            Other (optional)
          </span>
          <input
            className="mt-1 w-full rounded-lg border border-line bg-panel px-3 py-2.5 text-ink outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/25"
            value={filters.other}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, other: event.target.value }))
            }
            placeholder="paid, CPS, etc."
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void handleDiscover()
              }
            }}
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-line pt-5">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink-soft">
            {builtQuery ? (
              <>
                Will run:{' '}
                <span className="font-semibold text-ink">{builtQuery}</span>
              </>
            ) : (
              'Pick an interest and a when / type to build the search.'
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleDiscover()}
          disabled={!canSearch}
          className="btn-primary shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-60"
        >
          {searching ? 'Searching…' : 'Search'}
        </button>
      </div>
      <p className="mt-2 text-xs text-ink-soft">
        Add to Opportunities pulls page details the same way as Pull details on
        the tracker, then saves.
      </p>

      {usedQuery && (
        <p className="mt-4 text-xs text-ink-soft">
          Ran: <span className="font-semibold text-ink">{usedQuery}</span>
        </p>
      )}

      {info && (
        <div
          className="mt-3 flex flex-wrap items-center gap-3 text-sm font-semibold text-sage-deep"
          role="status"
        >
          <p>{info}</p>
          {onOpenOpportunities && (
            <button
              type="button"
              onClick={onOpenOpportunities}
              className="font-bold text-ink underline decoration-sage underline-offset-2 hover:text-sage"
            >
              View in Opportunities
            </button>
          )}
        </div>
      )}
      {error && (
        <p className="mt-3 text-sm font-semibold text-coral" role="alert">
          {error}
        </p>
      )}

      {hits.length > 0 && (
        <ul className="mt-5 divide-y divide-line border-y border-line">
          {hits.map((hit) => {
            const added = addedUrls.has(hit.url)
            const busy = addingUrl === hit.url
            return (
              <li
                key={hit.key}
                className="flex flex-wrap items-start justify-between gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{hit.title}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {hit.host}
                    {hit.matchNotes.length > 0
                      ? ` · matched ${hit.matchNotes.join(', ')}`
                      : ''}
                  </p>
                  <a
                    href={hit.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block break-all text-sm font-semibold text-sage-deep hover:text-ink"
                  >
                    {hit.url}
                  </a>
                  {hit.description && (
                    <p className="mt-1 text-sm text-ink-soft line-clamp-2">
                      {hit.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void handleAddLink(hit)}
                  disabled={busy || added}
                  className="btn-primary shrink-0 rounded-xl px-3 py-2 text-sm font-bold disabled:opacity-60"
                >
                  {added
                    ? 'In Opportunities'
                    : busy
                      ? 'Pulling details…'
                      : 'Add to Opportunities'}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {usedQuery && !searching && hits.length === 0 && engines.length > 0 && (
        <p className="mt-5 text-sm text-ink-soft">
          No usable program links after merging. Try different filters or orgs.
        </p>
      )}
    </section>
  )
}

function FilterRow({
  label,
  className = '',
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={className}>
      <p className="text-xs font-bold tracking-wide text-ink-soft uppercase">
        {label}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`filter-chip rounded-lg px-3 py-1.5 text-sm font-semibold ${
        active
          ? 'bg-sage text-foam'
          : 'bg-panel text-ink-soft ring-1 ring-line hover:text-ink'
      }`}
      aria-pressed={active}
    >
      {label}
    </button>
  )
}
