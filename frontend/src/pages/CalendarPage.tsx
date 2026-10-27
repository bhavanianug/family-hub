import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'

import {
  createCalendarEvent,
  deleteCalendarEvent,
  listCalendarEvents,
  updateCalendarEvent,
} from '../features/calendar/calendarApi'
import {
  chicagoDateKey,
  dateInputFromIso,
  eachDateKey,
  eventStartsAtIso,
  formatDayHeading,
  formatEventWhen,
  formatWeekLabel,
  rollingRange,
  timeInputFromIso,
  weekRangeContaining,
} from '../features/calendar/range'
import { useAuth } from '../features/auth/AuthProvider'
import { useGroup } from '../features/group/useGroup'
import { listGroupPeople } from '../features/people/peopleApi'
import type { Person } from '../features/people/useCurrentPerson'
import {
  CALENDAR_EVENT_KINDS,
  CALENDAR_IMPORTANCE,
  type CalendarEvent,
  type CalendarEventInput,
  type CalendarEventKind,
  type CalendarImportance,
  type CalendarView,
} from '../types/calendar'

const fieldClass =
  'mt-1 w-full rounded-lg border border-line bg-panel px-3 py-2.5 text-ink outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/25'

function labelKind(kind: CalendarEventKind): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1)
}

function whoLabel(personId: string | null, people: Person[]): string {
  if (!personId) return 'Everyone'
  return people.find((p) => p.id === personId)?.display_name ?? 'Someone'
}

type EventFormState = {
  title: string
  date: string
  time: string
  endTime: string
  allDay: boolean
  kind: CalendarEventKind
  importance: CalendarImportance
  personId: string
  location: string
  description: string
}

function emptyForm(defaultPersonId = ''): EventFormState {
  return {
    title: '',
    date: chicagoDateKey(new Date()),
    time: '09:00',
    endTime: '',
    allDay: false,
    kind: 'event',
    importance: 'normal',
    personId: defaultPersonId,
    location: '',
    description: '',
  }
}

function formFromEvent(event: CalendarEvent): EventFormState {
  return {
    title: event.title,
    date: dateInputFromIso(event.starts_at),
    time: event.all_day ? '09:00' : timeInputFromIso(event.starts_at),
    endTime:
      !event.all_day && event.ends_at ? timeInputFromIso(event.ends_at) : '',
    allDay: event.all_day,
    kind: event.kind,
    importance: event.importance,
    personId: event.person_id ?? '',
    location: event.location ?? '',
    description: event.description ?? '',
  }
}

function inputFromForm(form: EventFormState): CalendarEventInput {
  const startsAt = eventStartsAtIso(form.date, form.time, form.allDay)
  let endsAt: string | null = null
  if (!form.allDay && form.endTime.trim()) {
    endsAt = eventStartsAtIso(form.date, form.endTime, false)
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      throw new Error('End time must be after start time')
    }
  }
  return {
    title: form.title,
    description: form.description,
    location: form.location,
    starts_at: startsAt,
    ends_at: endsAt,
    all_day: form.allDay,
    kind: form.kind,
    importance: form.importance,
    person_id: form.personId || null,
  }
}

export function CalendarPage() {
  const { user } = useAuth()
  const { group, loading: groupLoading } = useGroup()

  const [view, setView] = useState<CalendarView>('week')
  const [weekOffset, setWeekOffset] = useState(0)
  const [personFilter, setPersonFilter] = useState<string>('all')
  const [importantOnly, setImportantOnly] = useState(false)

  const [people, setPeople] = useState<Person[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [form, setForm] = useState<EventFormState>(emptyForm)

  const range = useMemo(() => {
    if (view === 'week') {
      return weekRangeContaining(new Date(), weekOffset)
    }
    return rollingRange(view === '14' ? 14 : 30)
  }, [view, weekOffset])

  const refresh = useCallback(async () => {
    if (!group) {
      setEvents([])
      setPeople([])
      setLoading(groupLoading)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [eventRows, peopleRows] = await Promise.all([
        listCalendarEvents(group.id, range.start, range.end),
        listGroupPeople(group.id),
      ])
      setEvents(eventRows)
      setPeople(peopleRows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar')
    } finally {
      setLoading(false)
    }
  }, [group, groupLoading, range.start, range.end])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const visible = useMemo(() => {
    return events.filter((event) => {
      if (importantOnly && event.importance !== 'important') return false
      // All = whole family. A person = their events + shared (Everyone) events.
      if (personFilter === 'all') return true
      return !event.person_id || event.person_id === personFilter
    })
  }, [events, importantOnly, personFilter])

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const key of eachDateKey(range.startKey, range.endKey)) {
      map.set(key, [])
    }
    for (const event of visible) {
      const key = chicagoDateKey(event.starts_at)
      const list = map.get(key)
      if (list) list.push(event)
      else map.set(key, [event])
    }
    return map
  }, [visible, range.startKey, range.endKey])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setShowForm(true)
  }

  function openEdit(event: CalendarEvent) {
    setEditing(event)
    setForm(formFromEvent(event))
    setShowForm(true)
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (!group || !user) return
    setBusy(true)
    setError(null)
    try {
      let input: CalendarEventInput
      try {
        input = inputFromForm(form)
      } catch (validationErr) {
        setError(
          validationErr instanceof Error
            ? validationErr.message
            : 'Check start and end times',
        )
        setBusy(false)
        return
      }
      if (editing) {
        await updateCalendarEvent(editing.id, input)
      } else {
        await createCalendarEvent(group.id, user.id, input)
      }
      setShowForm(false)
      setEditing(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(eventId: string, title: string) {
    if (!confirm(`Delete “${title}”?`)) return
    setBusy(true)
    try {
      await deleteCalendarEvent(eventId)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  const dayKeys = eachDateKey(range.startKey, range.endKey)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.22em] text-sage-deep uppercase">
            Shared schedule
          </p>
          <h2 className="mt-1.5 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Coming up
          </h2>
          <p className="mt-2 max-w-xl text-sm text-ink-soft sm:text-base">
            Family dates in one place — tests, talks, appointments, and more.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="btn-primary rounded-xl px-4 py-2.5 text-sm font-bold"
        >
          Add event
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: 'week' as const, label: 'This week' },
            { id: '14' as const, label: 'Next 14 days' },
            { id: '30' as const, label: 'Next 30 days' },
          ]
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setView(item.id)
              if (item.id !== 'week') setWeekOffset(0)
            }}
            className={`filter-chip rounded-lg px-3 py-1.5 text-sm font-semibold ${
              view === item.id
                ? 'bg-sage text-foam'
                : 'bg-panel text-ink-soft ring-1 ring-line hover:text-ink'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {view === 'week' && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button
            type="button"
            className="font-semibold text-sage-deep hover:text-ink"
            onClick={() => setWeekOffset((n) => n - 1)}
          >
            ‹ Previous
          </button>
          <span className="font-semibold text-ink">
            {formatWeekLabel(range.startKey, range.endKey)}
          </span>
          <button
            type="button"
            className="font-semibold text-sage-deep hover:text-ink"
            onClick={() => setWeekOffset((n) => n + 1)}
          >
            Next ›
          </button>
          {weekOffset !== 0 && (
            <button
              type="button"
              className="font-semibold text-ink-soft hover:text-ink"
              onClick={() => setWeekOffset(0)}
            >
              This week
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <span className="font-semibold whitespace-nowrap">Who</span>
          <select
            className="rounded-lg border border-line bg-panel px-3 py-1.5 text-sm font-semibold text-ink"
            value={personFilter}
            onChange={(e) => setPersonFilter(e.target.value)}
          >
            <option value="all">All</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.display_name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={importantOnly}
            onChange={(e) => setImportantOnly(e.target.checked)}
          />
          Important only
        </label>
      </div>

      {(showForm || editing) && (
        <section className="surface-panel animate-pop-in rounded-2xl p-5 sm:p-7">
          <h3 className="font-display text-xl font-bold text-ink">
            {editing ? 'Edit event' : 'New event'}
          </h3>
          <form onSubmit={(e) => void handleSave(e)} className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-ink-soft">Title</span>
              <input
                className={fieldClass}
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Chem test, planetarium talk…"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block">
                <span className="text-sm font-semibold text-ink-soft">Date</span>
                <input
                  className={fieldClass}
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-ink-soft">Start</span>
                <input
                  className={fieldClass}
                  type="time"
                  disabled={form.allDay}
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-ink-soft">End</span>
                <input
                  className={fieldClass}
                  type="time"
                  disabled={form.allDay}
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  placeholder="Optional"
                />
              </label>
              <label className="flex items-end gap-2 pb-3 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={form.allDay}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      allDay: e.target.checked,
                      endTime: e.target.checked ? '' : form.endTime,
                    })
                  }
                />
                All day
              </label>
            </div>
            {!form.allDay && (
              <p className="text-xs text-ink-soft">
                End time is optional. Same day as the start for now.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm font-semibold text-ink-soft">Type</span>
                <select
                  className={fieldClass}
                  value={form.kind}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      kind: e.target.value as CalendarEventKind,
                    })
                  }
                >
                  {CALENDAR_EVENT_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {labelKind(kind)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-ink-soft">Who</span>
                <select
                  className={fieldClass}
                  value={form.personId}
                  onChange={(e) =>
                    setForm({ ...form, personId: e.target.value })
                  }
                >
                  <option value="">Everyone</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.display_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-ink-soft">
                  Importance
                </span>
                <select
                  className={fieldClass}
                  value={form.importance}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      importance: e.target.value as CalendarImportance,
                    })
                  }
                >
                  {CALENDAR_IMPORTANCE.map((value) => (
                    <option key={value} value={value}>
                      {value.charAt(0).toUpperCase() + value.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-semibold text-ink-soft">Location</span>
              <input
                className={fieldClass}
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-ink-soft">Notes</span>
              <textarea
                className={`${fieldClass} min-h-20`}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                spellCheck
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={busy}
                className="btn-primary rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-60"
              >
                {busy ? 'Saving…' : editing ? 'Save changes' : 'Add event'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditing(null)
                }}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-ink-soft hover:bg-ink/5"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {loading && <p className="text-ink-soft">Loading Coming up…</p>}
      {error && (
        <p className="font-semibold text-coral" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && (
        <div className="space-y-6">
          {dayKeys.map((dayKey) => {
            const dayEvents = byDay.get(dayKey) ?? []
            const isToday = dayKey === chicagoDateKey(new Date())
            return (
              <section key={dayKey}>
                <h3
                  className={`text-sm font-bold tracking-wide uppercase ${
                    isToday ? 'text-sage' : 'text-ink-soft'
                  }`}
                >
                  {formatDayHeading(dayKey)}
                  {isToday ? ' · Today' : ''}
                </h3>
                {dayEvents.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-soft/70">Nothing planned</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {dayEvents.map((item) => (
                      <li
                        key={item.id}
                        className={`list-row rounded-2xl border border-line px-4 py-3 sm:px-5 ${
                          item.importance === 'important'
                            ? 'border-l-4 border-l-sage'
                            : ''
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold tracking-wide text-sage-deep uppercase">
                              <span className="rounded-md bg-mist px-1.5 py-0.5">
                                {labelKind(item.kind)}
                              </span>
                              <span>{whoLabel(item.person_id, people)}</span>
                              {item.importance === 'important' && (
                                <span className="text-sun">Important</span>
                              )}
                            </div>
                            <h4 className="mt-1 font-display text-lg font-bold text-ink sm:text-xl">
                              {item.title}
                            </h4>
                            <p className="mt-1 text-sm text-ink-soft">
                              {[
                                formatEventWhen(
                                  item.starts_at,
                                  item.all_day,
                                  item.ends_at,
                                ),
                                item.location,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="rounded-lg px-3 py-2 text-sm font-semibold text-sage-deep hover:bg-sage/15"
                              onClick={() => openEdit(item)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="rounded-lg px-3 py-2 text-sm font-semibold text-coral hover:bg-coral/10"
                              disabled={busy}
                              onClick={() =>
                                void handleDelete(item.id, item.title)
                              }
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
