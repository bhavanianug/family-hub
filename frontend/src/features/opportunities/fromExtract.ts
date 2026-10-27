import type { ExtractedOpportunity } from '../../lib/api'
import type { OpportunityInput } from '../../types/opportunity'
import { deadlineToIso, normalizeTimingKind } from './format'

type ExtractFallback = {
  title: string
  location?: string
  timing_kind?: 'summer' | 'ongoing'
  description?: string
}

/**
 * Map Pull-details extract output into OpportunityInput rows.
 * Same field choices as OpportunityForm after a successful extract.
 */
export function opportunityInputsFromExtract(
  extracted: ExtractedOpportunity,
  fallback: ExtractFallback,
): OpportunityInput[] {
  const candidates = extracted.candidates ?? []
  const sharedLocation =
    extracted.location?.trim() || fallback.location?.trim() || 'Chicago, IL'
  const sharedOrg = extracted.organization?.trim() || undefined
  const sourceUrl = extracted.source_url || undefined
  const defaultTiming = normalizeTimingKind(
    extracted.timing_kind ?? fallback.timing_kind,
  )

  if (candidates.length > 1) {
    return candidates.map((candidate) => {
      const timingNote = candidate.application_timing?.trim()
      return {
        title: candidate.title.trim() || fallback.title,
        organization: sharedOrg,
        opportunity_type: 'program' as const,
        timing_kind: normalizeTimingKind(
          candidate.timing_kind ?? defaultTiming,
        ),
        description:
          candidate.description?.trim() ||
          extracted.description?.trim() ||
          fallback.description,
        location: candidate.location?.trim() || sharedLocation,
        source_url: candidate.source_url || sourceUrl,
        opens_at: deadlineToIso(candidate.opens_date ?? ''),
        deadline_at: deadlineToIso(candidate.deadline_date ?? ''),
        eligibility: candidate.eligibility?.trim() || undefined,
        status: 'saved' as const,
        notes: timingNote || undefined,
      }
    })
  }

  const only = candidates[0]
  const opensDate = only?.opens_date ?? extracted.opens_date
  const deadlineDate = only?.deadline_date ?? extracted.deadline_date
  const timing =
    only?.application_timing?.trim() ||
    extracted.application_timing?.trim() ||
    undefined
  const timingKind = normalizeTimingKind(
    only?.timing_kind ?? extracted.timing_kind ?? fallback.timing_kind,
  )

  return [
    {
      title:
        only?.title?.trim() ||
        extracted.title?.trim() ||
        fallback.title,
      organization: sharedOrg,
      opportunity_type: 'program',
      timing_kind: timingKind,
      description:
        only?.description?.trim() ||
        extracted.description?.trim() ||
        fallback.description,
      location: only?.location?.trim() || sharedLocation,
      source_url: only?.source_url || sourceUrl,
      opens_at: deadlineToIso(opensDate ?? ''),
      deadline_at: deadlineToIso(deadlineDate ?? ''),
      eligibility:
        only?.eligibility?.trim() ||
        extracted.eligibility?.trim() ||
        undefined,
      status: 'saved',
      notes: timing,
    },
  ]
}
