import { describe, expect, it } from 'vitest'

import { DEFAULT_DISCOVER_FILTERS } from './buildDiscoverQuery'
import type { MergedDiscoverHit } from './mergeDiscoverResults'
import {
  conflictsWithIntent,
  orgNeedles,
  rankDiscoverHits,
  scoreIntent,
} from './rankDiscoverHits'

function hit(
  partial: Partial<MergedDiscoverHit> & Pick<MergedDiscoverHit, 'title' | 'url'>,
): MergedDiscoverHit {
  return {
    key: partial.url,
    host: partial.host ?? 'example.org',
    description: partial.description ?? null,
    engines: partial.engines ?? ['openai'],
    ...partial,
  }
}

describe('rankDiscoverHits', () => {
  const filters = {
    ...DEFAULT_DISCOVER_FILTERS,
    interest: 'physics' as const,
    when: 'ongoing' as const,
    orgs: 'Northwestern University',
  }

  it('expands northwestern into host needles without generic university', () => {
    const needles = orgNeedles('Northwestern University')
    expect(needles).toEqual(
      expect.arrayContaining(['northwestern', 'nurph', 'ciera']),
    )
    expect(needles).not.toContain('university')
  })

  it('drops news and faq pages', () => {
    expect(
      conflictsWithIntent(
        hit({
          title: 'Chicago youth explore science',
          url: 'https://news.uchicago.edu/story/space-explorers',
          host: 'news.uchicago.edu',
        }),
        filters,
      ),
    ).toBe(true)
    expect(
      conflictsWithIntent(
        hit({
          title: 'FAQ',
          url: 'https://precollege.northwestern.edu/faq',
          host: 'precollege.northwestern.edu',
        }),
        filters,
      ),
    ).toBe(true)
  })

  it('ranks NURPH apply above CIERA hub and news', () => {
    const ranked = rankDiscoverHits(
      [
        hit({
          title: 'Programs – CIERA',
          url: 'https://ciera.northwestern.edu/programs/?filter_tax_ciera_audience=k-12',
          host: 'ciera.northwestern.edu',
          description: 'CIERA programs for K-12',
          engines: ['perplexity'],
        }),
        hit({
          title: 'REACH',
          url: 'https://ciera.northwestern.edu/programs/reach',
          host: 'ciera.northwestern.edu',
          description: 'Research Experiences in Astronomy for High School Students',
          engines: ['openai', 'perplexity'],
        }),
        hit({
          title: 'Apply | NURPH',
          url: 'https://sites.northwestern.edu/nurph/apply',
          host: 'sites.northwestern.edu',
          description:
            'NURPH applications open for Chicago and Evanston-area high schools',
          engines: ['openai'],
        }),
        hit({
          title: 'Chicago youth explore science',
          url: 'https://news.uchicago.edu/story/space-explorers',
          host: 'news.uchicago.edu',
          engines: ['perplexity'],
        }),
      ],
      filters,
    )

    expect(ranked.map((item) => item.title)).toEqual([
      'Apply | NURPH',
      'REACH',
      'Programs – CIERA',
    ])
    expect(
      scoreIntent(
        hit({
          title: 'Apply | NURPH',
          url: 'https://sites.northwestern.edu/nurph/apply',
          host: 'sites.northwestern.edu',
          description: 'high school students',
        }),
        filters,
      ).notes,
    ).toEqual(expect.arrayContaining(['org', 'apply page']))
  })
})
