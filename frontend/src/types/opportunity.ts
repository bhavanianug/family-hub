export const OPPORTUNITY_TYPES = [
  'internship',
  'program',
  'volunteer',
  'competition',
  'research',
  'museum',
  'scholarship',
  'other',
] as const

export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number]

/** Stored values may still include legacy `other` — treat that as ongoing in the UI. */
export const TIMING_KINDS = ['summer', 'ongoing'] as const
export type TimingKind = 'summer' | 'ongoing' | 'other'

export const TRACKING_STATUSES = [
  'saved',
  'in_progress',
  'submitted',
  'accepted',
  'declined',
  'withdrawn',
] as const

export type TrackingStatus = (typeof TRACKING_STATUSES)[number]

export const SOURCE_TYPES = ['manual', 'url', 'scraper'] as const
export type SourceType = (typeof SOURCE_TYPES)[number]

export type Opportunity = {
  id: string
  group_id: string
  title: string
  organization: string | null
  opportunity_type: OpportunityType
  description: string | null
  location: string | null
  source_type: SourceType
  source_url: string | null
  opens_at: string | null
  deadline_at: string | null
  timing_kind: TimingKind
  eligibility: string | null
  last_verified_at: string | null
  created_at: string
}

export type OpportunityTracking = {
  id: string
  opportunity_id: string
  person_id: string
  status: TrackingStatus
  notes: string | null
}

export type OpportunityWithTracking = Opportunity & {
  tracking: OpportunityTracking | null
}

export type OpportunityInput = {
  title: string
  organization?: string
  opportunity_type: OpportunityType
  description?: string
  location?: string
  source_url?: string
  opens_at?: string | null
  deadline_at?: string | null
  timing_kind?: TimingKind
  eligibility?: string
  status?: TrackingStatus
  notes?: string
}

export type OpportunityFilter =
  | 'all'
  | 'summer'
  | 'ongoing'
  | 'due_soon'
  | 'open'
  | 'saved'
  | 'in_progress'
  | 'submitted'
  | 'past'
