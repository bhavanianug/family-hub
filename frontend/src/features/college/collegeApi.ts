import { getSupabase } from '../../lib/supabase'
import type {
  CollegeDeadlineFields,
  CollegeTarget,
  CollegeTargetInput,
} from '../../types/college'

const COLLEGE_SELECT =
  'id, group_id, name, band, source_url, why_this_college, notes, deadline_early_action, deadline_early_decision, deadline_regular, application_timing, deadlines_updated_at, created_at'

export async function listCollegeTargets(
  groupId: string,
): Promise<CollegeTarget[]> {
  const { data, error } = await getSupabase()
    .from('college_targets')
    .select(COLLEGE_SELECT)
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
    why_this_college: input.why_this_college?.trim() || null,
    notes: input.notes?.trim() || null,
    created_by: userId,
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function updateCollegeTarget(
  collegeId: string,
  patch: Partial<
    Pick<CollegeTarget, 'name' | 'band' | 'source_url' | 'why_this_college' | 'notes'> &
      CollegeDeadlineFields
  >,
): Promise<void> {
  const payload: Record<string, string | null> = {}
  if (patch.name !== undefined) payload.name = patch.name.trim()
  if (patch.band !== undefined) payload.band = patch.band
  if (patch.source_url !== undefined) {
    payload.source_url = patch.source_url.trim() || null
  }
  if (patch.why_this_college !== undefined) {
    payload.why_this_college = patch.why_this_college.trim() || null
  }
  if (patch.notes !== undefined) {
    payload.notes = patch.notes.trim() || null
  }
  if (patch.deadline_early_action !== undefined) {
    payload.deadline_early_action = patch.deadline_early_action
  }
  if (patch.deadline_early_decision !== undefined) {
    payload.deadline_early_decision = patch.deadline_early_decision
  }
  if (patch.deadline_regular !== undefined) {
    payload.deadline_regular = patch.deadline_regular
  }
  if (patch.application_timing !== undefined) {
    payload.application_timing = patch.application_timing?.trim() || null
  }
  if (patch.deadlines_updated_at !== undefined) {
    payload.deadlines_updated_at = patch.deadlines_updated_at
  }

  const { error } = await getSupabase()
    .from('college_targets')
    .update(payload)
    .eq('id', collegeId)

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
