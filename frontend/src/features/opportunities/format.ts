import type {
  OpportunityType,
  TimingKind,
  TrackingStatus,
} from '../../types/opportunity'

export function formatDeadline(deadlineAt: string | null): string {
  if (!deadlineAt) return 'No deadline'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(deadlineAt))
}

export function deadlineInputValue(deadlineAt: string | null): string {
  if (!deadlineAt) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(deadlineAt))
}

export function deadlineToIso(dateValue: string): string | null {
  if (!dateValue) return null
  return new Date(`${dateValue}T23:59:59.000-05:00`).toISOString()
}

export function labelType(type: OpportunityType): string {
  return type.replaceAll('_', ' ')
}

export function normalizeTimingKind(kind: TimingKind | null | undefined): 'summer' | 'ongoing' {
  return kind === 'summer' ? 'summer' : 'ongoing'
}

export function labelTimingKind(kind: TimingKind | null | undefined): string {
  return normalizeTimingKind(kind) === 'summer' ? 'Summer' : 'Ongoing'
}

export function labelStatus(status: TrackingStatus): string {
  return status.replaceAll('_', ' ')
}
