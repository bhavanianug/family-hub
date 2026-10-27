export type DiscoverWho = 'high_school' | 'middle_school'
export type DiscoverInterest =
  | 'stem'
  | 'architecture'
  | 'physics'
  | 'math'
  | 'nature'
  | 'museum'
  | 'research'
  | 'volunteering'
  | 'arts'
export type DiscoverWhen =
  | 'summer'
  | 'ongoing'
  | 'volunteer'
  | 'internship'

export type DiscoverFilters = {
  who: DiscoverWho
  /** Free-text US place (city, metro, state, or "US remote"). */
  where: string
  interest: DiscoverInterest | null
  when: DiscoverWhen | null
  orgs: string
  other: string
}

export const WHO_OPTIONS: { id: DiscoverWho; label: string; query: string }[] =
  [
    { id: 'high_school', label: 'High school', query: 'high school teen' },
    { id: 'middle_school', label: 'Middle school', query: 'middle school' },
  ]

export const INTEREST_OPTIONS: {
  id: DiscoverInterest
  label: string
  query: string
}[] = [
  { id: 'stem', label: 'STEM', query: 'STEM' },
  {
    id: 'architecture',
    label: 'Architecture / design',
    query: 'architecture design',
  },
  { id: 'physics', label: 'Physics / space', query: 'physics space' },
  { id: 'math', label: 'Math', query: 'math' },
  {
    id: 'nature',
    label: 'Nature / outdoors',
    query: 'nature outdoors',
  },
  { id: 'museum', label: 'Museum / culture', query: 'museum culture' },
  { id: 'research', label: 'Research / lab', query: 'research lab' },
  {
    id: 'volunteering',
    label: 'Volunteering / service',
    query: 'volunteering service',
  },
  { id: 'arts', label: 'Arts', query: 'arts' },
]

export const WHEN_OPTIONS: {
  id: DiscoverWhen
  label: string
  query: string
}[] = [
  { id: 'summer', label: 'Summer', query: 'summer' },
  { id: 'ongoing', label: 'Ongoing', query: 'ongoing' },
  { id: 'volunteer', label: 'Volunteer', query: 'volunteer' },
  {
    id: 'internship',
    label: 'Internship / research',
    query: 'internship research',
  },
]

export const DEFAULT_DISCOVER_FILTERS: DiscoverFilters = {
  who: 'high_school',
  where: 'Chicago',
  interest: null,
  when: null,
  orgs: '',
  other: '',
}

function optionQuery<T extends string>(
  options: { id: T; query: string }[],
  id: T,
): string {
  return options.find((item) => item.id === id)?.query ?? id
}

/** Build the search ask from filters. Interest + when are required. */
export function buildDiscoverQuery(filters: DiscoverFilters): string | null {
  if (!filters.interest || !filters.when) {
    return null
  }

  const where = filters.where.trim() || 'Chicago'

  const parts = [
    where,
    optionQuery(WHO_OPTIONS, filters.who),
    optionQuery(INTEREST_OPTIONS, filters.interest),
    optionQuery(WHEN_OPTIONS, filters.when),
  ]

  const orgs = filters.orgs
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  if (orgs.length) {
    parts.push(orgs.join(' '))
  }

  const other = filters.other.trim()
  if (other) {
    parts.push(other)
  }

  parts.push('official program')
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}
