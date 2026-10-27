export const CALENDAR_EVENT_KINDS = [
  'test',
  'event',
  'appointment',
  'deadline',
  'other',
] as const

export type CalendarEventKind = (typeof CALENDAR_EVENT_KINDS)[number]

export const CALENDAR_IMPORTANCE = ['normal', 'important'] as const
export type CalendarImportance = (typeof CALENDAR_IMPORTANCE)[number]

export const CALENDAR_VIEWS = ['week', '14', '30'] as const
export type CalendarView = (typeof CALENDAR_VIEWS)[number]

export type CalendarEvent = {
  id: string
  group_id: string
  title: string
  description: string | null
  location: string | null
  starts_at: string
  ends_at: string | null
  all_day: boolean
  kind: CalendarEventKind
  importance: CalendarImportance
  person_id: string | null
  created_at: string
}

export type CalendarEventInput = {
  title: string
  description?: string
  location?: string
  starts_at: string
  ends_at?: string | null
  all_day?: boolean
  kind: CalendarEventKind
  importance: CalendarImportance
  person_id?: string | null
}
