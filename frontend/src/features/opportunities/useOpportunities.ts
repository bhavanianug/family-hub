import { useCallback, useEffect, useMemo, useState } from 'react'

import type {
  OpportunityFilter,
  OpportunityInput,
  OpportunityWithTracking,
  TrackingStatus,
} from '../../types/opportunity'
import { useAuth } from '../auth/AuthProvider'
import { useGroup } from '../group/useGroup'
import { useCurrentPerson } from '../people/useCurrentPerson'
import {
  createOpportunities,
  deleteOpportunity,
  listOpportunities,
  updateOpportunity,
  updateTrackingStatus,
} from './opportunityApi'

const DAY_MS = 24 * 60 * 60 * 1000

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

export function useOpportunities() {
  const { user } = useAuth()
  const { group, loading: groupLoading } = useGroup()
  const { person, loading: personLoading } = useCurrentPerson()
  const [items, setItems] = useState<OpportunityWithTracking[]>([])
  const [filter, setFilter] = useState<OpportunityFilter>('all')
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

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const status = item.tracking?.status
      switch (filter) {
        case 'summer':
          return item.timing_kind === 'summer'
        case 'ongoing':
          return item.timing_kind === 'ongoing'
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
  }, [items, filter])

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
    items: filtered,
    allCount: items.length,
    filter,
    setFilter,
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
