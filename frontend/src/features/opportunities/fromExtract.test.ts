import { describe, expect, it } from 'vitest'

import type { ExtractedOpportunity } from '../../lib/api'
import { opportunityInputsFromExtract } from './fromExtract'

const base: ExtractedOpportunity = {
  source_url: 'https://sites.northwestern.edu/nurph/apply',
  title: 'NURPH',
  organization: 'Northwestern University',
  description: 'Research program for high schoolers',
  location: 'Evanston, IL',
  opens_date: null,
  deadline_date: '2026-03-15',
  application_timing: 'Applications open until March 15, 2026',
  timing_kind: 'summer',
  eligibility: 'Chicago and Evanston-area high school students',
  candidates: [],
  warnings: [],
}

describe('opportunityInputsFromExtract', () => {
  it('maps a single program page like Pull details', () => {
    const [input] = opportunityInputsFromExtract(base, {
      title: 'fallback',
      location: 'Chicago',
    })
    expect(input?.title).toBe('NURPH')
    expect(input?.organization).toBe('Northwestern University')
    expect(input?.timing_kind).toBe('summer')
    expect(input?.eligibility).toContain('high school')
    expect(input?.deadline_at).toBeTruthy()
    expect(input?.notes).toContain('March 15')
    expect(input?.source_url).toContain('nurph/apply')
  })

  it('expands multiple candidates into separate rows', () => {
    const extracted: ExtractedOpportunity = {
      ...base,
      candidates: [
        {
          title: 'Program A',
          description: null,
          opens_date: null,
          deadline_date: null,
          application_timing: null,
          timing_kind: 'summer',
          eligibility: null,
          location: null,
          source_url: null,
        },
        {
          title: 'Program B',
          description: null,
          opens_date: null,
          deadline_date: null,
          application_timing: null,
          timing_kind: 'ongoing',
          eligibility: null,
          location: null,
          source_url: null,
        },
      ],
    }
    const inputs = opportunityInputsFromExtract(extracted, { title: 'hub' })
    expect(inputs).toHaveLength(2)
    expect(inputs.map((item) => item.title)).toEqual(['Program A', 'Program B'])
  })
})
