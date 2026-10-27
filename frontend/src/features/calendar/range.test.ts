import { describe, expect, it } from 'vitest'

import {
  chicagoDateKey,
  eachDateKey,
  eventStartsAtIso,
  formatDayHeading,
  rollingRange,
} from './range'

describe('eachDateKey', () => {
  it('includes start and end', () => {
    expect(eachDateKey('2026-10-26', '2026-10-28')).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
    ])
  })
})

describe('rollingRange', () => {
  it('spans the requested number of days', () => {
    const range = rollingRange(14, new Date('2026-10-26T17:00:00.000Z'))
    const keys = eachDateKey(range.startKey, range.endKey)
    expect(keys).toHaveLength(14)
  })
})

describe('eventStartsAtIso + chicagoDateKey', () => {
  it('keeps Nov 2 as Nov 2 after CST (post-DST)', () => {
    const iso = eventStartsAtIso('2026-11-02', '09:00', false)
    expect(chicagoDateKey(iso)).toBe('2026-11-02')
  })

  it('keeps all-day Nov 2 as Nov 2', () => {
    const iso = eventStartsAtIso('2026-11-02', '', true)
    expect(chicagoDateKey(iso)).toBe('2026-11-02')
  })
})

describe('formatDayHeading', () => {
  it('does not shift Nov 2 to Nov 1', () => {
    expect(formatDayHeading('2026-11-02')).toContain('2')
    expect(formatDayHeading('2026-11-02')).not.toMatch(/\b1\b/)
  })
})
