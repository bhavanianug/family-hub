import { getSupabase } from '../../lib/supabase'
import type { CalendarEvent, CalendarEventInput } from '../../types/calendar'

const EVENT_SELECT =
  'id, group_id, title, description, location, starts_at, ends_at, all_day, kind, importance, person_id, created_at'

export async function listCalendarEvents(
  groupId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<CalendarEvent[]> {
  const { data, error } = await getSupabase()
    .from('calendar_events')
    .select(EVENT_SELECT)
    .eq('group_id', groupId)
    .gte('starts_at', rangeStart.toISOString())
    .lte('starts_at', rangeEnd.toISOString())
    .order('starts_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }
  return (data ?? []) as CalendarEvent[]
}

export async function createCalendarEvent(
  groupId: string,
  userId: string,
  input: CalendarEventInput,
): Promise<void> {
  const title = input.title.trim()
  if (!title) {
    throw new Error('Title is required')
  }

  const { error } = await getSupabase().from('calendar_events').insert({
    group_id: groupId,
    title,
    description: input.description?.trim() || null,
    location: input.location?.trim() || null,
    starts_at: input.starts_at,
    ends_at: input.ends_at || null,
    all_day: input.all_day ?? false,
    kind: input.kind,
    importance: input.importance,
    person_id: input.person_id || null,
    created_by: userId,
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function updateCalendarEvent(
  eventId: string,
  input: CalendarEventInput,
): Promise<void> {
  const title = input.title.trim()
  if (!title) {
    throw new Error('Title is required')
  }

  const { error } = await getSupabase()
    .from('calendar_events')
    .update({
      title,
      description: input.description?.trim() || null,
      location: input.location?.trim() || null,
      starts_at: input.starts_at,
      ends_at: input.ends_at || null,
      all_day: input.all_day ?? false,
      kind: input.kind,
      importance: input.importance,
      person_id: input.person_id || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('calendar_events')
    .delete()
    .eq('id', eventId)

  if (error) {
    throw new Error(error.message)
  }
}
