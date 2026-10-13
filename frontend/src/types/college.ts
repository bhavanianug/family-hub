export const COLLEGE_BANDS = [
  'safety',
  'target',
  'reach',
  'far_reach',
] as const

export type CollegeBand = (typeof COLLEGE_BANDS)[number]

export type CollegeTarget = {
  id: string
  group_id: string
  name: string
  band: CollegeBand
  source_url: string | null
  notes: string | null
  created_at: string
}

export type CollegeTargetInput = {
  name: string
  band?: CollegeBand
  source_url?: string
  notes?: string
}

export function labelCollegeBand(band: CollegeBand): string {
  if (band === 'far_reach') return 'Far reach'
  return band.charAt(0).toUpperCase() + band.slice(1)
}
