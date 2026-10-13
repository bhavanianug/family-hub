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
  why_this_college: string | null
  notes: string | null
  deadline_early_action: string | null
  deadline_early_decision: string | null
  deadline_regular: string | null
  application_timing: string | null
  deadlines_updated_at: string | null
  created_at: string
}

export type CollegeTargetInput = {
  name: string
  band?: CollegeBand
  source_url?: string
  why_this_college?: string
  notes?: string
}

export type CollegeDeadlineFields = Pick<
  CollegeTarget,
  | 'source_url'
  | 'deadline_early_action'
  | 'deadline_early_decision'
  | 'deadline_regular'
  | 'application_timing'
  | 'deadlines_updated_at'
>

export function labelCollegeBand(band: CollegeBand): string {
  if (band === 'far_reach') return 'Far reach'
  return band.charAt(0).toUpperCase() + band.slice(1)
}

export function formatCollegeDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const day = iso.slice(0, 10)
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!match) return iso
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
