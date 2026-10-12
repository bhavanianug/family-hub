import { useCallback, useEffect, useState } from 'react'

import { getSupabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { useGroup } from '../group/useGroup'

export type Person = {
  id: string
  group_id: string
  user_id: string | null
  display_name: string
  person_type: string
}

export function useCurrentPerson() {
  const { user } = useAuth()
  const { group } = useGroup()
  const [person, setPerson] = useState<Person | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user || !group) {
      setPerson(null)
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error: queryError } = await getSupabase()
      .from('people')
      .select('id, group_id, user_id, display_name, person_type')
      .eq('user_id', user.id)
      .eq('group_id', group.id)
      .maybeSingle()

    if (queryError) {
      setError(queryError.message)
      setPerson(null)
    } else {
      setError(null)
      setPerson(data)
    }
    setLoading(false)
  }, [user, group])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { person, loading, error, refresh }
}
