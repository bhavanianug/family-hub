import { getSupabase } from '../../lib/supabase'
import type { Person } from './useCurrentPerson'

export async function listGroupPeople(groupId: string): Promise<Person[]> {
  const { data, error } = await getSupabase()
    .from('people')
    .select('id, group_id, user_id, display_name, person_type')
    .eq('group_id', groupId)
    .order('display_name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }
  return (data ?? []) as Person[]
}
