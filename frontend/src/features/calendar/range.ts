const TZ = 'America/Chicago'

/** YYYY-MM-DD in Chicago for an instant. */
export function chicagoDateKey(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function partsFromKey(dateKey: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateKey.split('-').map(Number)
  return { y, m, d }
}

function keyFromUtcParts(y: number, m: number, d: number): string {
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

type ChicagoParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

function chicagoParts(date: Date): ChicagoParts {
  const map = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
  }
}

/**
 * Interpret a Chicago calendar date + HH:mm as local wall time → UTC Date.
 * Avoids fixed ±05:00 offsets that break around DST.
 */
export function chicagoLocalToUtc(
  dateKey: string,
  timeHHmm: string,
  second = 0,
  ms = 0,
): Date {
  const { y, m, d } = partsFromKey(dateKey)
  const [hour, minute] = timeHHmm.split(':').map(Number)
  const desiredAsUtc = Date.UTC(y, m - 1, d, hour, minute, second, ms)

  let utcMs = desiredAsUtc
  for (let i = 0; i < 3; i += 1) {
    const seen = chicagoParts(new Date(utcMs))
    const seenAsUtc = Date.UTC(
      seen.year,
      seen.month - 1,
      seen.day,
      seen.hour,
      seen.minute,
      second,
      ms,
    )
    utcMs += desiredAsUtc - seenAsUtc
  }
  return new Date(utcMs)
}

export function startOfChicagoDay(dateKey: string): Date {
  return chicagoLocalToUtc(dateKey, '00:00', 0, 0)
}

export function endOfChicagoDay(dateKey: string): Date {
  return chicagoLocalToUtc(dateKey, '23:59', 59, 999)
}

/** Monday–Sunday week containing `anchor` (Chicago calendar), plus weekOffset. */
export function weekRangeContaining(
  anchor: Date,
  weekOffset = 0,
): { start: Date; end: Date; startKey: string; endKey: string } {
  const key = chicagoDateKey(anchor)
  const { y, m, d } = partsFromKey(key)
  const probe = new Date(Date.UTC(y, m - 1, d, 17, 0, 0))
  const dow = probe.getUTCDay() // 0 Sun … 6 Sat
  const daysFromMonday = (dow + 6) % 7
  const monday = new Date(
    Date.UTC(y, m - 1, d - daysFromMonday + weekOffset * 7, 12, 0, 0),
  )
  const sunday = new Date(
    Date.UTC(y, m - 1, d - daysFromMonday + weekOffset * 7 + 6, 12, 0, 0),
  )
  const startKey = keyFromUtcParts(
    monday.getUTCFullYear(),
    monday.getUTCMonth() + 1,
    monday.getUTCDate(),
  )
  const endKey = keyFromUtcParts(
    sunday.getUTCFullYear(),
    sunday.getUTCMonth() + 1,
    sunday.getUTCDate(),
  )
  return {
    start: startOfChicagoDay(startKey),
    end: endOfChicagoDay(endKey),
    startKey,
    endKey,
  }
}

export function rollingRange(
  days: number,
  from = new Date(),
): { start: Date; end: Date; startKey: string; endKey: string } {
  const startKey = chicagoDateKey(from)
  const { y, m, d } = partsFromKey(startKey)
  const endKey = keyFromUtcParts(y, m, d + (days - 1))
  return {
    start: startOfChicagoDay(startKey),
    end: endOfChicagoDay(endKey),
    startKey,
    endKey,
  }
}

export function eachDateKey(startKey: string, endKey: string): string[] {
  const keys: string[] = []
  let { y, m, d } = partsFromKey(startKey)
  for (let i = 0; i < 62; i += 1) {
    const key = keyFromUtcParts(y, m, d)
    keys.push(key)
    if (key === endKey) break
    const next = new Date(Date.UTC(y, m - 1, d + 1, 12, 0, 0))
    y = next.getUTCFullYear()
    m = next.getUTCMonth() + 1
    d = next.getUTCDate()
  }
  return keys
}

/** Format a YYYY-MM-DD key without timezone shift. */
export function formatDayHeading(dateKey: string): string {
  const { y, m, d } = partsFromKey(dateKey)
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function formatWeekLabel(startKey: string, endKey: string): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  })
  const start = partsFromKey(startKey)
  const end = partsFromKey(endKey)
  return `${fmt.format(new Date(Date.UTC(start.y, start.m - 1, start.d, 12)))} – ${fmt.format(new Date(Date.UTC(end.y, end.m - 1, end.d, 12)))}`
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function formatEventWhen(
  startsAt: string,
  allDay: boolean,
  endsAt?: string | null,
): string {
  if (allDay) return 'All day'
  const start = formatTime(startsAt)
  if (!endsAt) return start
  return `${start} – ${formatTime(endsAt)}`
}

export function eventStartsAtIso(
  dateValue: string,
  timeValue: string,
  allDay: boolean,
): string {
  if (!dateValue) return new Date().toISOString()
  const time = allDay || !timeValue ? '12:00' : timeValue
  return chicagoLocalToUtc(dateValue, time).toISOString()
}

export function dateInputFromIso(iso: string): string {
  return chicagoDateKey(iso)
}

export function timeInputFromIso(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}
