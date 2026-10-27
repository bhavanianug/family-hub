import { describe, expect, it } from 'vitest'

import {
  DEFAULT_DISCOVER_FILTERS,
  buildDiscoverQuery,
} from './buildDiscoverQuery'

describe('buildDiscoverQuery', () => {
  it('returns null until interest and when are set', () => {
    expect(buildDiscoverQuery(DEFAULT_DISCOVER_FILTERS)).toBeNull()
    expect(
      buildDiscoverQuery({
        ...DEFAULT_DISCOVER_FILTERS,
        interest: 'architecture',
      }),
    ).toBeNull()
  })

  it('builds a Chicago high school architecture summer ask', () => {
    expect(
      buildDiscoverQuery({
        ...DEFAULT_DISCOVER_FILTERS,
        interest: 'architecture',
        when: 'summer',
      }),
    ).toBe(
      'Chicago high school teen architecture design summer official program',
    )
  })

  it('uses free-text where and appends orgs and other', () => {
    expect(
      buildDiscoverQuery({
        who: 'high_school',
        where: 'Evanston',
        interest: 'physics',
        when: 'internship',
        orgs: 'Argonne, Fermilab',
        other: 'paid',
      }),
    ).toBe(
      'Evanston high school teen physics space internship research Argonne Fermilab paid official program',
    )
  })

  it('falls back to Chicago when where is blank', () => {
    expect(
      buildDiscoverQuery({
        ...DEFAULT_DISCOVER_FILTERS,
        where: '  ',
        interest: 'math',
        when: 'ongoing',
      }),
    ).toBe('Chicago high school teen math ongoing official program')
  })
})
