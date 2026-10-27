import type { DiscoverEngineResult, ScanProposal } from '../../lib/api'

export type MergedDiscoverHit = {
  key: string
  title: string
  url: string
  host: string
  description: string | null
  engines: string[]
}

function normalizeUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    parsed.hash = ''
    ;[
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
    ].forEach((key) => parsed.searchParams.delete(key))
    if (parsed.pathname.includes('/iframe/')) {
      parsed.pathname = parsed.pathname.replace('/iframe/', '/')
    }
    parsed.searchParams.delete('date')
    let href = parsed.toString()
    if (href.endsWith('/')) {
      href = href.slice(0, -1)
    }
    return href
  } catch {
    return null
  }
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'page'
  }
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}

function titleQuality(title: string, host: string): number {
  const text = title.trim()
  if (!text) return 0
  if (text.toLowerCase() === host.toLowerCase()) return 1
  if (text.includes('.') && !text.includes(' ')) return 2
  return 10 + Math.min(text.length, 80)
}

function isJunkUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return (
    lower.includes('/teacher-workshop') ||
    lower.includes('/gocps/high-school/apply') ||
    lower.includes('/gocps/high-school/explore') ||
    lower.includes('riseresearch.com') ||
    lower.includes('immerse.education') ||
    lower.includes('empowerly.com') ||
    lower.includes('news.uchicago.edu') ||
    lower.includes('/faq') ||
    /\/news(\/|$|\?)/.test(lower)
  )
}

/**
 * Group key for the same program on different URLs
 * (NURPH home vs apply, Space Explorers on two UChicago hosts).
 */
export function programFamilyKey(hit: MergedDiscoverHit): string {
  const path = pathOf(hit.url)
  const title = hit.title.toLowerCase()
  const host = hit.host.toLowerCase()

  if (path.includes('nurph') || /\bnurph\b/.test(title)) {
    return 'program:nurph'
  }
  if (path.includes('/reach') || (/\breach\b/.test(title) && host.includes('ciera'))) {
    return 'program:ciera-reach'
  }
  if (
    path.includes('space-explorers') ||
    path.includes('space_explorers') ||
    title.includes('space explorers')
  ) {
    return 'program:space-explorers'
  }
  if (path.includes('prism') || /\bprism\b/.test(title)) {
    return 'program:fermilab-prism'
  }

  // WordPress / Sites paths: /nurph/apply → already handled; generic /slug
  if (host.startsWith('sites.')) {
    const slug = path.split('/').filter(Boolean)[0]
    if (slug) return `sites:${host}/${slug}`
  }

  // Unique by normalized URL — no extra collapsing.
  return `url:${hit.url}`
}

function pagePreference(hit: MergedDiscoverHit): number {
  const path = pathOf(hit.url)
  if (path.includes('/apply')) return 100
  if (/\/programs?\/[^/?]+/.test(path)) return 85
  if (path.includes('space-explorers')) return 80
  if (path.includes('?filter') || path.includes('filter_tax')) return 15
  if (path.endsWith('/outreach') || path.endsWith('/programs')) return 20
  if (path.endsWith('/public-outreach.html')) return 25
  return 50
}

function pickBestInFamily(group: MergedDiscoverHit[]): MergedDiscoverHit {
  const sorted = [...group].sort((a, b) => {
    const pref = pagePreference(b) - pagePreference(a)
    if (pref !== 0) return pref
    const engines = b.engines.length - a.engines.length
    if (engines !== 0) return engines
    return titleQuality(b.title, b.host) - titleQuality(a.title, a.host)
  })
  const best = sorted[0]!
  const engines = new Set<string>()
  for (const item of group) {
    for (const engine of item.engines) engines.add(engine)
  }
  return {
    ...best,
    engines: [...engines].sort(),
    description:
      best.description ??
      group.find((item) => item.description)?.description ??
      null,
  }
}

/** Collapse NURPH apply+home, Space Explorers mirrors, etc. into one row. */
export function collapseRelatedHits(
  hits: MergedDiscoverHit[],
): MergedDiscoverHit[] {
  const byFamily = new Map<string, MergedDiscoverHit[]>()
  for (const hit of hits) {
    const key = programFamilyKey(hit)
    const list = byFamily.get(key) ?? []
    list.push(hit)
    byFamily.set(key, list)
  }

  let collapsed = [...byFamily.values()].map(pickBestInFamily)

  // If we already have a specific CIERA program page, drop listing hubs.
  const hasCieraProgram = collapsed.some((hit) =>
    /ciera\.northwestern\.edu\/programs\/[^/?]+/i.test(hit.url),
  )
  if (hasCieraProgram) {
    collapsed = collapsed.filter((hit) => {
      const path = pathOf(hit.url)
      const lower = hit.url.toLowerCase()
      if (!hit.host.includes('ciera.northwestern.edu')) return true
      if (lower.includes('filter_tax') || lower.includes('?filter')) return false
      if (path === '/outreach' || path === '/programs' || path === '/programs/') {
        return false
      }
      return true
    })
  }

  return collapsed
}

/**
 * Merge OpenAI + Perplexity into one deduped list for review/add.
 * Prefer the clearer program title; keep which engines found the URL.
 */
export function mergeDiscoverResults(
  engines: DiscoverEngineResult[],
): MergedDiscoverHit[] {
  const byUrl = new Map<
    string,
    {
      title: string
      titleScore: number
      description: string | null
      engines: Set<string>
    }
  >()

  for (const engine of engines) {
    for (const proposal of engine.proposals as ScanProposal[]) {
      const raw = proposal.item_url || proposal.source_url
      if (!raw) continue
      const url = normalizeUrl(raw)
      if (!url || isJunkUrl(url)) continue

      const host = hostFromUrl(url)
      const title = (proposal.title || host).trim()
      const score = titleQuality(title, host)
      const existing = byUrl.get(url)
      if (!existing) {
        byUrl.set(url, {
          title,
          titleScore: score,
          description: proposal.description,
          engines: new Set([engine.engine]),
        })
        continue
      }
      existing.engines.add(engine.engine)
      if (score > existing.titleScore) {
        existing.title = title
        existing.titleScore = score
      }
      if (!existing.description && proposal.description) {
        existing.description = proposal.description
      }
    }
  }

  const deduped = [...byUrl.entries()].map(([url, item]) => ({
    key: url,
    title: item.title,
    url,
    host: hostFromUrl(url),
    description: item.description,
    engines: [...item.engines].sort(),
  }))

  return collapseRelatedHits(deduped)
}
