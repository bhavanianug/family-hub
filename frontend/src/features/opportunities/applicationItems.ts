import type { ApplicationItem } from '../../types/opportunity'

export function newApplicationItem(
  partial?: Partial<Pick<ApplicationItem, 'question' | 'answer' | 'done'>>,
): ApplicationItem {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    question: partial?.question ?? '',
    answer: partial?.answer ?? '',
    done: partial?.done ?? false,
  }
}

export function normalizeApplicationItems(raw: unknown): ApplicationItem[] {
  if (!Array.isArray(raw)) return []
  const items: ApplicationItem[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const record = row as Record<string, unknown>
    const id =
      typeof record.id === 'string' && record.id.trim()
        ? record.id.trim()
        : newApplicationItem().id
    const question = typeof record.question === 'string' ? record.question : ''
    const answer = typeof record.answer === 'string' ? record.answer : ''
    const done = Boolean(record.done)
    items.push({ id, question, answer, done })
  }
  return items
}

export function applicationItemsProgress(items: ApplicationItem[]): {
  done: number
  total: number
} {
  const usable = items.filter(
    (item) => item.question.trim() || item.answer.trim() || item.done,
  )
  return {
    done: usable.filter((item) => item.done).length,
    total: usable.length,
  }
}

/** Drop blank rows before persist. */
export function sanitizeApplicationItems(
  items: ApplicationItem[] | undefined,
): ApplicationItem[] {
  if (!items) return []
  return items
    .map((item) => ({
      id: item.id || newApplicationItem().id,
      question: item.question.trim(),
      answer: item.answer.trim(),
      done: Boolean(item.done),
    }))
    .filter((item) => item.question || item.answer || item.done)
}
