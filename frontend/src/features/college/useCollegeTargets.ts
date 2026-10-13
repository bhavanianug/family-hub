import { useCallback, useEffect, useState } from 'react'

import type {
  CollegeDeadlineFields,
  CollegeTarget,
  CollegeTargetInput,
} from '../../types/college'
import { useAuth } from '../auth/AuthProvider'
import { useGroup } from '../group/useGroup'
import {
  createCollegeTarget,
  deleteCollegeTarget,
  listCollegeTargets,
  updateCollegeTarget,
} from './collegeApi'

export function useCollegeTargets() {
  const { user } = useAuth()
  const { group, loading: groupLoading } = useGroup()
  const [items, setItems] = useState<CollegeTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!group) {
      setItems([])
      setLoading(groupLoading)
      return
    }

    setLoading(true)
    setError(null)
    try {
      setItems(await listCollegeTargets(group.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load colleges')
    } finally {
      setLoading(false)
    }
  }, [group, groupLoading])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function add(input: CollegeTargetInput) {
    if (!group || !user) {
      return { error: 'Group not loaded' }
    }
    try {
      await createCollegeTarget(group.id, user.id, input)
      await refresh()
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Create failed' }
    }
  }

  async function update(
    collegeId: string,
    patch: Partial<
      Pick<
        CollegeTarget,
        'name' | 'band' | 'source_url' | 'why_this_college' | 'notes'
      > &
        CollegeDeadlineFields
    >,
  ) {
    try {
      await updateCollegeTarget(collegeId, patch)
      await refresh()
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Update failed' }
    }
  }

  async function remove(collegeId: string) {
    try {
      await deleteCollegeTarget(collegeId)
      await refresh()
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Delete failed' }
    }
  }

  return {
    items,
    loading: loading || groupLoading,
    error,
    add,
    update,
    remove,
    refresh,
  }
}
