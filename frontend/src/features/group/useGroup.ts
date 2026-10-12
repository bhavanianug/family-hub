import { useCallback, useEffect, useState } from 'react'

import { getSupabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'

export type GroupSummary = {
  id: string
  name: string
  invite_code: string
  role: string
  member_count: number
}

export function useGroup() {
  const { user } = useAuth()
  const [group, setGroup] = useState<GroupSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) {
      setGroup(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const supabase = getSupabase()
    const { data: membership, error: membershipError } = await supabase
      .from('group_members')
      .select('role, group_id, groups(id, name, invite_code)')
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipError) {
      setError(membershipError.message)
      setGroup(null)
      setLoading(false)
      return
    }

    if (!membership?.groups) {
      setGroup(null)
      setLoading(false)
      return
    }

    const groupRow = membership.groups as unknown as {
      id: string
      name: string
      invite_code: string
    }

    const { count } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupRow.id)

    setGroup({
      id: groupRow.id,
      name: groupRow.name,
      invite_code: groupRow.invite_code,
      role: membership.role,
      member_count: count ?? 1,
    })
    setLoading(false)
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function joinWithInvite(inviteCode: string) {
    const { error: joinError } = await getSupabase().rpc('join_group_with_invite', {
      invite: inviteCode.trim(),
    })
    if (joinError) {
      return { error: joinError.message }
    }
    await refresh()
    return { error: null }
  }

  async function rotateInviteCode() {
    if (!group) {
      return { error: 'No group loaded', code: null as string | null }
    }
    const { data, error: rotateError } = await getSupabase().rpc(
      'rotate_group_invite_code',
      { target_group_id: group.id },
    )
    if (rotateError) {
      return { error: rotateError.message, code: null }
    }
    await refresh()
    return { error: null, code: data as string }
  }

  return { group, loading, error, refresh, joinWithInvite, rotateInviteCode }
}
