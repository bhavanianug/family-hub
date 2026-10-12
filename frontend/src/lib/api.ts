import type { HealthResponse } from '../types/health'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export type TimingKind = 'summer' | 'ongoing' | 'other'

export type ExtractCandidate = {
  title: string
  description: string | null
  opens_date: string | null
  deadline_date: string | null
  application_timing: string | null
  timing_kind: TimingKind | null
  eligibility: string | null
  location: string | null
  source_url: string | null
}

export type ExtractedOpportunity = {
  source_url: string
  title: string | null
  organization: string | null
  description: string | null
  location: string | null
  opens_date: string | null
  deadline_date: string | null
  application_timing: string | null
  timing_kind: TimingKind | null
  eligibility: string | null
  candidates: ExtractCandidate[]
  warnings: string[]
}

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${apiBaseUrl}/api/health`)

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`)
  }

  return response.json() as Promise<HealthResponse>
}

async function readErrorDetail(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string }
    if (typeof payload.detail === 'string') {
      return payload.detail
    }
  } catch {
    // ignore JSON parse errors
  }
  return fallback
}

export async function extractFromUrl(
  url: string,
  accessToken: string,
): Promise<ExtractedOpportunity> {
  const response = await fetch(`${apiBaseUrl}/api/intake/extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ url }),
  })

  if (!response.ok) {
    throw new Error(
      await readErrorDetail(response, `Extract failed (${response.status})`),
    )
  }

  return response.json() as Promise<ExtractedOpportunity>
}

export type CuratedSource = {
  id: string
  name: string
  url: string
}

export type SourcesResponse = {
  sources: CuratedSource[]
  llm_enabled: boolean
}

export type ScanProposal = {
  key: string
  source_id: string
  source_name: string
  source_url: string
  title: string
  organization: string | null
  description: string | null
  location: string | null
  opens_date: string | null
  deadline_date: string | null
  application_timing: string | null
  timing_kind: TimingKind | null
  eligibility: string | null
  item_url: string | null
  warnings: string[]
}

export type ScanResponse = {
  proposals: ScanProposal[]
  errors: {
    source_id: string
    source_name: string
    source_url: string
    detail: string
  }[]
  llm_used: boolean
}

export async function fetchCuratedSources(
  accessToken: string,
): Promise<SourcesResponse> {
  const response = await fetch(`${apiBaseUrl}/api/intake/sources`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw new Error(
      await readErrorDetail(response, `Sources failed (${response.status})`),
    )
  }
  return response.json() as Promise<SourcesResponse>
}

export async function scanCuratedSources(
  accessToken: string,
): Promise<ScanResponse> {
  const response = await fetch(`${apiBaseUrl}/api/intake/scan`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw new Error(
      await readErrorDetail(response, `Scan failed (${response.status})`),
    )
  }
  return response.json() as Promise<ScanResponse>
}

export { apiBaseUrl }
