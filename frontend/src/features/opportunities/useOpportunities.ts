import { useCallback, useEffect, useMemo, useState } from 'react'

import type {
  OpportunityFilter,
  OpportunityInput,
  OpportunitySort,
  OpportunityWithTracking,
  TrackingStatus,
} from '../../types/opportunity'
import { useAuth } from '../auth/AuthProvider'
import { useGroup } from '../group/useGroup'
import { useCurrentPerson } from '../people/useCurrentPerson'
import { normalizeTimingKind } from './format'
import {
  createOpportunities,
  deleteOpportunity,
  listOpportunities,
  updateOpportunity,
  updateTrackingStatus,
} from './opportunityApi'

const DAY_MS = 24 * 60 * 60 * 1000
const FAR_FUTURE = Number.MAX_SAFE_INTEGER

function isPast(deadline: string | null): boolean {
  if (!deadline) return false
  return new Date(deadline).getTime() < Date.now()
}

function isDueSoon(deadline: string | null): boolean {
  if (!deadline) return false
  const t = new Date(deadline).getTime()
  const now = Date.now()
  return t >= now && t <= now + 14 * DAY_MS
}

/** Upcoming dates first; past next; missing last. */
function dateSortKey(iso: string | null | undefined, now: number): number {
  if (!iso) return FAR_FUTURE
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return FAR_FUTURE
  if (t < now) return FAR_FUTURE / 2 + t
  return t
}

function compareOpportunities(
  a: OpportunityWithTracking,
  b: OpportunityWithTracking,
  sort: OpportunitySort,
): number {
  const now = Date.now()

  switch (sort) {
    case 'opens': {
      const diff = dateSortKey(a.opens_at, now) - dateSortKey(b.opens_at, now)
      if (diff !== 0) return diff
      return dateSortKey(a.deadline_at, now) - dateSortKey(b.deadline_at, now)
    }
    case 'recent': {
      const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0
      const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0
      return bCreated - aCreated
    }
    case 'title':
      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
    case 'deadline':
    default: {
      const diff = dateSortKey(a.deadline_at, now) - dateSortKey(b.deadline_at, now)
      if (diff !== 0) return diff
      return dateSortKey(a.opens_at, now) - dateSortKey(b.opens_at, now)
    }
  }
}

export function useOpportunities() {
  const { user } = useAuth()
  const { group, loading: groupLoading } = useGroup()
  const { person, loading: personLoading } = useCurrentPerson()
  const [items, setItems] = useState<OpportunityWithTracking[]>([])
  const [filter, setFilter] = useState<OpportunityFilter>('all')
  const [sort, setSort] = useState<OpportunitySort>('deadline')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!group || !person) {
      setItems([])
      setLoading(groupLoading || personLoading)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const rows = await listOpportunities(group.id, person.id)
      setItems(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load opportunities')
    } finally {
      setLoading(false)
    }
  }, [group, person, groupLoading, personLoading])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const visible = useMemo(() => {
    const filtered = items.filter((item) => {
      const status = item.tracking?.status
      switch (filter) {
        case 'summer':
          return normalizeTimingKind(item.timing_kind) === 'summer'
        case 'ongoing':
          return normalizeTimingKind(item.timing_kind) === 'ongoing'
        case 'due_soon':
          return isDueSoon(item.deadline_at)
        case 'open':
          return !isPast(item.deadline_at)
        case 'past':
          return isPast(item.deadline_at)
        case 'saved':
        case 'in_progress':
        case 'submitted':
          return status === filter
        default:
          return true
      }
    })

    return [...filtered].sort((a, b) => compareOpportunities(a, b, sort))
  }, [items, filter, sort])

  async function add(input: OpportunityInput | OpportunityInput[]) {
    if (!group || !person || !user) {
      return { error: 'Group or person not loaded' }
    }
    const inputs = Array.isArray(input) ? input : [input]
    try {
      await createOpportunities(group.id, person.id, user.id, inputs)
      await refresh()
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Create failed' }
    }
  }

  async function save(opportunityId: string, input: OpportunityInput) {
    if (!person) {
      return { error: 'Person not loaded' }
    }
    try {
      await updateOpportunity(opportunityId, person.id, input)
      await refresh()
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Update failed' }
    }
  }

  async function setStatus(opportunityId: string, status: TrackingStatus) {
    if (!person) {
      return { error: 'Person not loaded' }
    }
    try {
      await updateTrackingStatus(opportunityId, person.id, status)
      await refresh()
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Status update failed' }
    }
  }

  async function remove(opportunityId: string) {
    try {
      await deleteOpportunity(opportunityId)
      await refresh()
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Delete failed' }
    }
  }

  return {
    items: visible,
    allCount: items.length,
    filter,
    setFilter,
    sort,
    setSort,
    loading: loading || groupLoading || personLoading,
    error,
    refresh,
    add,
    save,
    setStatus,
    remove,
    group,
    person,
  }
}
