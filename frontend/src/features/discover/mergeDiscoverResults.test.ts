import { describe, expect, it } from 'vitest'

import type { DiscoverEngineResult } from '../../lib/api'
import {
  collapseRelatedHits,
  mergeDiscoverResults,
  type MergedDiscoverHit,
} from './mergeDiscoverResults'

function engine(
  name: string,
  proposals: { title: string; url: string }[],
): DiscoverEngineResult {
  return {
    engine: name,
    proposals: proposals.map((item, index) => ({
      key: `${name}-${index}`,
      source_id: `${name}-${index}`,
      source_name: 'host',
      source_url: item.url,
      title: item.title,
      organization: null,
      description: null,
      location: null,
      opens_date: null,
      deadline_date: null,
      application_timing: null,
      timing_kind: null,
      eligibility: null,
      item_url: item.url,
      warnings: [],
    })),
    errors: [],
    llm_used: false,
    candidate_urls: proposals.map((item) => item.url),
    summary: null,
  }
}

function hit(
  partial: Pick<MergedDiscoverHit, 'title' | 'url' | 'host'> &
    Partial<MergedDiscoverHit>,
): MergedDiscoverHit {
  return {
    key: partial.url,
    description: null,
    engines: ['openai'],
    ...partial,
  }
}

describe('mergeDiscoverResults', () => {
  it('dedupes the same URL across engines and prefers a real title', () => {
    const merged = mergeDiscoverResults([
      engine('openai', [
        {
          title: 'education.fnal.gov',
          url: 'https://education.fnal.gov/program-type/student-programs/?utm_source=openai',
        },
      ]),
      engine('perplexity', [
        {
          title: 'Student programs – Fermilab',
          url: 'https://education.fnal.gov/program-type/student-programs/',
        },
      ]),
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0]?.title).toBe('Student programs – Fermilab')
    expect(merged[0]?.engines).toEqual(['openai', 'perplexity'])
  })

  it('collapses NURPH home + apply into the apply page', () => {
    const collapsed = collapseRelatedHits([
      hit({
        title: 'NURPH',
        url: 'https://sites.northwestern.edu/nurph',
        host: 'sites.northwestern.edu',
      }),
      hit({
        title: 'Apply | NURPH',
        url: 'https://sites.northwestern.edu/nurph/apply',
        host: 'sites.northwestern.edu',
      }),
    ])
    expect(collapsed).toHaveLength(1)
    expect(collapsed[0]?.url).toContain('/apply')
  })

  it('collapses Space Explorers mirrors into one row', () => {
    const collapsed = collapseRelatedHits([
      hit({
        title: 'Space Explorers Program',
        url: 'https://ccreadiness.uchicago.edu/pages/space-explorers-program',
        host: 'ccreadiness.uchicago.edu',
      }),
      hit({
        title: 'Space Explorers | Kavli',
        url: 'https://kavlicosmo.uchicago.edu/outreach/space-explorers',
        host: 'kavlicosmo.uchicago.edu',
      }),
    ])
    expect(collapsed).toHaveLength(1)
  })

  it('keeps REACH and drops CIERA hub when both exist', () => {
    const collapsed = collapseRelatedHits([
      hit({
        title: 'REACH',
        url: 'https://ciera.northwestern.edu/programs/reach',
        host: 'ciera.northwestern.edu',
      }),
      hit({
        title: 'Programs – CIERA',
        url: 'https://ciera.northwestern.edu/programs/?filter_tax_ciera_audience=k-12',
        host: 'ciera.northwestern.edu',
      }),
      hit({
        title: 'Education & Outreach',
        url: 'https://ciera.northwestern.edu/outreach',
        host: 'ciera.northwestern.edu',
      }),
    ])
    expect(collapsed.map((item) => item.title)).toEqual(['REACH'])
  })

  it('drops teacher and CPS application junk', () => {
    const merged = mergeDiscoverResults([
      engine('perplexity', [
        {
          title: 'Teacher workshops',
          url: 'https://education.fnal.gov/teacher-workshops/',
        },
        {
          title: 'Apply to High School',
          url: 'https://www.cps.edu/gocps/high-school/apply/',
        },
        {
          title: 'PRISM',
          url: 'https://internships.fnal.gov/fermilab-program-for-research-innovation-and-stem-mentorship-prism/',
        },
      ]),
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0]?.title).toBe('PRISM')
  })
})
