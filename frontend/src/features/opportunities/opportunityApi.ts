import { getSupabase } from '../../lib/supabase'
import type {
  OpportunityInput,
  OpportunityTracking,
  OpportunityWithTracking,
  TrackingStatus,
} from '../../types/opportunity'
import {
  normalizeApplicationItems,
  sanitizeApplicationItems,
} from './applicationItems'

const TRACKING_SELECT =
  'id, opportunity_id, person_id, status, notes, apply_url, application_doc_url, submitted_at, confirmation_code, application_items'

function mapTracking(
  row: Record<string, unknown>,
): OpportunityTracking {
  return {
    id: String(row.id),
    opportunity_id: String(row.opportunity_id),
    person_id: String(row.person_id),
    status: row.status as TrackingStatus,
    notes: (row.notes as string | null) ?? null,
    apply_url: (row.apply_url as string | null) ?? null,
    application_doc_url: (row.application_doc_url as string | null) ?? null,
    submitted_at: (row.submitted_at as string | null) ?? null,
    confirmation_code: (row.confirmation_code as string | null) ?? null,
    application_items: normalizeApplicationItems(row.application_items),
  }
}

function trackingPayload(input: OpportunityInput) {
  const status = input.status ?? 'saved'
  let submittedAt = input.submitted_at || null
  if (status === 'submitted' && !submittedAt) {
    submittedAt = new Date().toISOString()
  }
  return {
    status,
    notes: input.notes?.trim() || null,
    apply_url: input.apply_url?.trim() || null,
    application_doc_url: input.application_doc_url?.trim() || null,
    submitted_at: submittedAt,
    confirmation_code: input.confirmation_code?.trim() || null,
    application_items: sanitizeApplicationItems(input.application_items),
  }
}

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
      .select(TRACKING_SELECT)
      .eq('person_id', personId)
      .in('opportunity_id', ids)

    if (trackingError) {
      throw new Error(trackingError.message)
    }

    trackingByOpportunity = new Map(
      (tracking ?? []).map((row) => [
        row.opportunity_id as string,
        mapTracking(row as Record<string, unknown>),
      ]),
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
    ...trackingPayload(input),
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
        ...trackingPayload(input),
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
      ...trackingPayload(input),
    })

    if (trackingError) {
      throw new Error(trackingError.message)
    }
  }
}

export type ApplicationRecordInput = {
  status: TrackingStatus
  apply_url?: string
  application_doc_url?: string
  submitted_at?: string | null
  confirmation_code?: string
  application_items: OpportunityTracking['application_items']
  notes?: string
}

/** Save application Q/A + meta without rewriting opportunity catalog fields. */
export async function saveApplicationRecord(
  opportunityId: string,
  personId: string,
  input: ApplicationRecordInput,
): Promise<void> {
  const supabase = getSupabase()
  const payload = {
    ...trackingPayload({
      title: '',
      opportunity_type: 'other',
      status: input.status,
      apply_url: input.apply_url,
      application_doc_url: input.application_doc_url,
      submitted_at: input.submitted_at,
      confirmation_code: input.confirmation_code,
      application_items: input.application_items,
      notes: input.notes,
    }),
    updated_at: new Date().toISOString(),
  }

  const { data: existing } = await supabase
    .from('opportunity_tracking')
    .select('id')
    .eq('opportunity_id', opportunityId)
    .eq('person_id', personId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('opportunity_tracking')
      .update(payload)
      .eq('id', existing.id)
    if (error) {
      throw new Error(error.message)
    }
    return
  }

  const { error } = await supabase.from('opportunity_tracking').insert({
    opportunity_id: opportunityId,
    person_id: personId,
    ...payload,
  })
  if (error) {
    throw new Error(error.message)
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
    .select('id, submitted_at')
    .eq('opportunity_id', opportunityId)
    .eq('person_id', personId)
    .maybeSingle()

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (status === 'submitted' && !existing?.submitted_at) {
    patch.submitted_at = new Date().toISOString()
  }

  if (existing) {
    const { error } = await supabase
      .from('opportunity_tracking')
      .update(patch)
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
    submitted_at: status === 'submitted' ? new Date().toISOString() : null,
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
