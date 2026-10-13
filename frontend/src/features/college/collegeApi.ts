import { getSupabase } from '../../lib/supabase'
import type { CollegeTarget, CollegeTargetInput } from '../../types/college'

export async function listCollegeTargets(
  groupId: string,
): Promise<CollegeTarget[]> {
  const { data, error } = await getSupabase()
    .from('college_targets')
    .select('id, group_id, name, band, source_url, notes, created_at')
    .eq('group_id', groupId)
    .order('name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function createCollegeTarget(
  groupId: string,
  userId: string,
  input: CollegeTargetInput,
): Promise<void> {
  const name = input.name.trim()
  if (!name) {
    throw new Error('College name is required')
  }

  const { error } = await getSupabase().from('college_targets').insert({
    group_id: groupId,
    name,
    band: input.band ?? 'target',
    source_url: input.source_url?.trim() || null,
    notes: input.notes?.trim() || null,
    created_by: userId,
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function deleteCollegeTarget(collegeId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('college_targets')
    .delete()
    .eq('id', collegeId)

  if (error) {
    throw new Error(error.message)
  }
}
