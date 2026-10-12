import { getSupabase } from '../../lib/supabase'
import type {
  OpportunityInput,
  OpportunityWithTracking,
  TrackingStatus,
} from '../../types/opportunity'

function titleFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return host
  } catch {
    return 'Opportunity from URL'
  }
}

export async function listOpportunities(
  groupId: string,
  personId: string,
): Promise<OpportunityWithTracking[]> {
  const supabase = getSupabase()

  const { data: opportunities, error } = await supabase
    .from('opportunities')
    .select(
      'id, group_id, title, organization, opportunity_type, description, location, source_type, source_url, opens_at, deadline_at, timing_kind, eligibility, last_verified_at, created_at',
    )
    .eq('group_id', groupId)
    .order('deadline_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const ids = (opportunities ?? []).map((row) => row.id)
  let trackingByOpportunity = new Map<string, OpportunityWithTracking['tracking']>()

  if (ids.length > 0) {
    const { data: tracking, error: trackingError } = await supabase
      .from('opportunity_tracking')
      .select('id, opportunity_id, person_id, status, notes')
      .eq('person_id', personId)
      .in('opportunity_id', ids)

    if (trackingError) {
      throw new Error(trackingError.message)
    }

    trackingByOpportunity = new Map(
      (tracking ?? []).map((row) => [row.opportunity_id, row]),
    )
  }

  return (opportunities ?? []).map((row) => ({
    ...row,
    tracking: trackingByOpportunity.get(row.id) ?? null,
  }))
}

export async function createOpportunity(
  groupId: string,
  personId: string,
  userId: string,
  input: OpportunityInput,
): Promise<void> {
  const supabase = getSupabase()
  const sourceUrl = input.source_url?.trim() || null
  const title = input.title.trim() || (sourceUrl ? titleFromUrl(sourceUrl) : '')

  if (!title) {
    throw new Error('Title is required')
  }

  const { data: opportunity, error } = await supabase
    .from('opportunities')
    .insert({
      group_id: groupId,
      title,
      organization: input.organization?.trim() || null,
      opportunity_type: input.opportunity_type,
      description: input.description?.trim() || null,
      location: input.location?.trim() || null,
      source_type: sourceUrl ? 'url' : 'manual',
      source_url: sourceUrl,
      opens_at: input.opens_at || null,
      deadline_at: input.deadline_at || null,
      timing_kind: input.timing_kind === 'summer' ? 'summer' : 'ongoing',
      eligibility: input.eligibility?.trim() || null,
      last_verified_at: new Date().toISOString(),
      created_by: userId,
    })
    .select('id')
    .single()

  if (error || !opportunity) {
    throw new Error(error?.message ?? 'Could not create opportunity')
  }

  const { error: trackingError } = await supabase.from('opportunity_tracking').insert({
    opportunity_id: opportunity.id,
    person_id: personId,
    status: input.status ?? 'saved',
    notes: input.notes?.trim() || null,
  })

  if (trackingError) {
    throw new Error(trackingError.message)
  }
}

export async function createOpportunities(
  groupId: string,
  personId: string,
  userId: string,
  inputs: OpportunityInput[],
): Promise<void> {
  if (inputs.length === 0) {
    throw new Error('No opportunities to create')
  }

  for (const input of inputs) {
    await createOpportunity(groupId, personId, userId, input)
  }
}

export async function updateOpportunity(
  opportunityId: string,
  personId: string,
  input: OpportunityInput,
): Promise<void> {
  const supabase = getSupabase()
  const sourceUrl = input.source_url?.trim() || null

  const { error } = await supabase
    .from('opportunities')
    .update({
      title: input.title.trim(),
      organization: input.organization?.trim() || null,
      opportunity_type: input.opportunity_type,
      description: input.description?.trim() || null,
      location: input.location?.trim() || null,
      source_type: sourceUrl ? 'url' : 'manual',
      source_url: sourceUrl,
      opens_at: input.opens_at || null,
      deadline_at: input.deadline_at || null,
      timing_kind: input.timing_kind === 'summer' ? 'summer' : 'ongoing',
      eligibility: input.eligibility?.trim() || null,
      last_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', opportunityId)

  if (error) {
    throw new Error(error.message)
  }

  const { data: existing } = await supabase
    .from('opportunity_tracking')
    .select('id')
    .eq('opportunity_id', opportunityId)
    .eq('person_id', personId)
    .maybeSingle()

  if (existing) {
    const { error: trackingError } = await supabase
      .from('opportunity_tracking')
      .update({
        status: input.status ?? 'saved',
        notes: input.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (trackingError) {
      throw new Error(trackingError.message)
    }
  } else {
    const { error: trackingError } = await supabase.from('opportunity_tracking').insert({
      opportunity_id: opportunityId,
      person_id: personId,
      status: input.status ?? 'saved',
      notes: input.notes?.trim() || null,
    })

    if (trackingError) {
      throw new Error(trackingError.message)
    }
  }
}

export async function updateTrackingStatus(
  opportunityId: string,
  personId: string,
  status: TrackingStatus,
): Promise<void> {
  const supabase = getSupabase()
  const { data: existing } = await supabase
    .from('opportunity_tracking')
    .select('id')
    .eq('opportunity_id', opportunityId)
    .eq('person_id', personId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('opportunity_tracking')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) {
      throw new Error(error.message)
    }
    return
  }

  const { error } = await supabase.from('opportunity_tracking').insert({
    opportunity_id: opportunityId,
    person_id: personId,
    status,
  })
  if (error) {
    throw new Error(error.message)
  }
}

export async function deleteOpportunity(opportunityId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('opportunities')
    .delete()
    .eq('id', opportunityId)

  if (error) {
    throw new Error(error.message)
  }
}
