import {
  INTEREST_OPTIONS,
  WHEN_OPTIONS,
  WHO_OPTIONS,
  type DiscoverFilters,
  type DiscoverInterest,
  type DiscoverWhen,
} from './buildDiscoverQuery'
import type { MergedDiscoverHit } from './mergeDiscoverResults'

export type RankedDiscoverHit = MergedDiscoverHit & {
  intentScore: number
  matchNotes: string[]
}

const INTEREST_SYNONYMS: Record<DiscoverInterest, string[]> = {
  stem: ['stem', 'science', 'engineering', 'research'],
  architecture: ['architecture', 'design', 'build'],
  physics: [
    'physics',
    'space',
    'astronomy',
    'astrophysics',
    'quantum',
    'particle',
    'cosmo',
  ],
  math: ['math', 'mathematics'],
  nature: ['nature', 'ecology', 'outdoors', 'environment', 'conservation'],
  museum: ['museum', 'culture', 'exhibit'],
  research: ['research', 'lab', 'internship', 'laboratory'],
  volunteering: ['volunteer', 'service', 'steward'],
  arts: ['arts', 'art', 'theatre', 'music'],
}

const WHEN_SYNONYMS: Record<DiscoverWhen, string[]> = {
  summer: ['summer'],
  ongoing: [
    'ongoing',
    'year-round',
    'year round',
    'multi-year',
    'school year',
    'saturday',
    'after-school',
    'after school',
  ],
  volunteer: ['volunteer'],
  internship: ['internship', 'intern', 'research program'],
}

const ORG_STOPWORDS = new Set([
  'university',
  'college',
  'school',
  'institute',
  'center',
  'centre',
  'research',
  'program',
  'laboratory',
  'lab',
  'the',
  'and',
  'for',
  'of',
])

/** Expand typed org names into host / text needles. */
export function orgNeedles(orgsField: string): string[] {
  const needles = new Set<string>()
  for (const raw of orgsField.split(',')) {
    const org = raw.trim().toLowerCase()
    if (org.length < 3) continue
    needles.add(org)
    for (const token of org.split(/\s+/)) {
      if (token.length >= 4 && !ORG_STOPWORDS.has(token)) {
        needles.add(token)
      }
    }
    // Common US lab / university short forms.
    if (org.includes('northwestern') || org.startsWith('northwester')) {
      needles.add('northwestern')
      needles.add('ciera')
      needles.add('nurph')
    }
    if (org.includes('fermilab') || org.includes('fermi')) {
      needles.add('fermilab')
      needles.add('fnal')
    }
    if (org.includes('argonne')) {
      needles.add('argonne')
      needles.add('anl.gov')
    }
    if (org.includes('uchicago') || org.includes('university of chicago')) {
      needles.add('uchicago')
      needles.add('kavli')
    }
  }
  return [...needles]
}

function blob(hit: MergedDiscoverHit): string {
  return `${hit.title} ${hit.host} ${hit.url} ${hit.description ?? ''}`.toLowerCase()
}

function optionQuery(
  options: { id: string; query: string }[],
  id: string | null,
): string {
  if (!id) return ''
  return options.find((item) => item.id === id)?.query ?? id
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}

/** Drop results that are not useful program application pages. */
export function conflictsWithIntent(
  hit: MergedDiscoverHit,
  filters: DiscoverFilters,
): boolean {
  const text = blob(hit)
  const path = pathOf(hit.url)
  const who = filters.who
  const host = hit.host.toLowerCase()

  if (
    host.startsWith('news.') ||
    path.includes('/news') ||
    path.endsWith('/faq') ||
    path.includes('/faq/') ||
    text.includes('teacher workshop') ||
    text.includes('for teachers') ||
    path.includes('/teacher-') ||
    (text.includes('quarknet') && text.includes('teacher'))
  ) {
    return true
  }

  // Bare hostnames with no real title are usually junk.
  if (hit.title.trim().toLowerCase() === host) {
    return true
  }

  if (who === 'high_school') {
    if (
      text.includes('ages 8-10') ||
      text.includes('ages 8–10') ||
      text.includes('ages 11-14') ||
      text.includes('ages 11–14') ||
      text.includes('elementary') ||
      text.includes('incoming first-year') ||
      text.includes('admitted beginning first-year')
    ) {
      return true
    }
  }

  if (who === 'middle_school' && text.includes('high school senior')) {
    return true
  }

  return false
}

function matchesAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => needle.length > 2 && text.includes(needle))
}

/**
 * Score a hit against the filter ask. Higher = closer to intent.
 * Org + apply/program pages beat keyword-only news/hub hits.
 */
export function scoreIntent(
  hit: MergedDiscoverHit,
  filters: DiscoverFilters,
): { score: number; notes: string[] } {
  const text = blob(hit)
  const path = pathOf(hit.url)
  let score = 0
  const notes: string[] = []

  const orgs = orgNeedles(filters.orgs)
  const hasOrg = orgs.length > 0 && matchesAny(text, orgs)
  if (hasOrg) {
    score += 45
    notes.push('org')
  }

  if (hit.engines.length > 1) {
    score += 8
    notes.push('both engines')
  }

  const where = filters.where.trim().toLowerCase()
  if (where) {
    const whereTokens = where.split(/\s+/).filter((t) => t.length > 2)
    if (whereTokens.some((token) => text.includes(token))) {
      score += 6
      notes.push('location')
    }
  }

  const whoQuery = optionQuery(WHO_OPTIONS, filters.who).toLowerCase()
  const whoNeedles = [
    ...whoQuery.split(/\s+/),
    ...(filters.who === 'high_school'
      ? ['high school', 'high-school', 'teen']
      : ['middle school', 'middle-school']),
  ]
  if (matchesAny(text, whoNeedles)) {
    score += 14
    notes.push('who')
  }

  if (filters.interest) {
    const interestNeedles = [
      ...optionQuery(INTEREST_OPTIONS, filters.interest)
        .toLowerCase()
        .split(/\s+/),
      ...INTEREST_SYNONYMS[filters.interest],
    ]
    if (matchesAny(text, interestNeedles)) {
      score += 16
      notes.push('interest')
    } else if (hasOrg) {
      // Org-targeted search: don't punish STEM research pages that omit "physics".
      score += 6
    }
  }

  if (filters.when) {
    const whenNeedles = [
      ...optionQuery(WHEN_OPTIONS, filters.when).toLowerCase().split(/\s+/),
      ...WHEN_SYNONYMS[filters.when],
    ]
    if (matchesAny(text, whenNeedles)) {
      score += 10
      notes.push('when')
    }
  }

  // Page-shape signals: real program / apply pages beat hubs and stories.
  if (path.includes('/apply') || text.includes('applications are now open')) {
    score += 40
    notes.push('apply page')
  }
  if (
    /\/programs?\/[^/?]+/.test(path) ||
    path.includes('/program/') ||
    /\/[a-z]*nurph/.test(path) ||
    text.includes('research program for high school')
  ) {
    score += 18
    notes.push('program page')
  }
  if (path.includes('?filter') || path.endsWith('/programs') || path.endsWith('/programs/')) {
    score -= 18
    notes.push('hub')
  }
  if (path.includes('/outreach') && !path.includes('/space-explorers')) {
    score -= 16
  }
  if (text.includes('public outreach') && !text.includes('high school')) {
    score -= 12
  }
  if (text.includes('field trip')) score -= 20
  if (text.includes('workforce development')) score -= 24
  if (hostIsNews(hit.host) || path.includes('/news')) score -= 40
  if (hit.title.toLowerCase() === hit.host.toLowerCase()) score -= 20

  return { score, notes: [...new Set(notes)] }
}

function hostIsNews(host: string): boolean {
  return host.startsWith('news.') || host.includes('.news.')
}

/** Filter clear mismatches, then rank by how well the hit matches the ask. */
export function rankDiscoverHits(
  hits: MergedDiscoverHit[],
  filters: DiscoverFilters,
): RankedDiscoverHit[] {
  return hits
    .filter((hit) => !conflictsWithIntent(hit, filters))
    .map((hit) => {
      const { score, notes } = scoreIntent(hit, filters)
      return { ...hit, intentScore: score, matchNotes: notes }
    })
    .filter((hit) => hit.intentScore > 0)
    .sort((a, b) => {
      if (b.intentScore !== a.intentScore) {
        return b.intentScore - a.intentScore
      }
      return a.title.localeCompare(b.title)
    })
}
