import { describe, expect, it } from 'vitest'

import {
  applicationItemsProgress,
  normalizeApplicationItems,
  sanitizeApplicationItems,
} from './applicationItems'

describe('normalizeApplicationItems', () => {
  it('returns empty for non-arrays', () => {
    expect(normalizeApplicationItems(null)).toEqual([])
    expect(normalizeApplicationItems({})).toEqual([])
  })

  it('keeps valid rows and fills missing fields', () => {
    const items = normalizeApplicationItems([
      { id: 'a', question: 'Why?', answer: 'Because', done: true },
      { question: 'Only Q' },
      null,
      'skip',
    ])
    expect(items).toHaveLength(2)
    expect(items[0]).toEqual({
      id: 'a',
      question: 'Why?',
      answer: 'Because',
      done: true,
    })
    expect(items[1].question).toBe('Only Q')
    expect(items[1].answer).toBe('')
    expect(items[1].done).toBe(false)
    expect(items[1].id).toBeTruthy()
  })
})

describe('sanitizeApplicationItems', () => {
  it('drops blank rows and trims text', () => {
    expect(
      sanitizeApplicationItems([
        { id: '1', question: '  Q  ', answer: '  A  ', done: false },
        { id: '2', question: '', answer: '', done: false },
        { id: '3', question: '', answer: '', done: true },
      ]),
    ).toEqual([
      { id: '1', question: 'Q', answer: 'A', done: false },
      { id: '3', question: '', answer: '', done: true },
    ])
  })
})

describe('applicationItemsProgress', () => {
  it('counts only usable rows', () => {
    expect(
      applicationItemsProgress([
        { id: '1', question: 'Q', answer: '', done: true },
        { id: '2', question: '', answer: '', done: false },
        { id: '3', question: '', answer: 'A', done: false },
      ]),
    ).toEqual({ done: 1, total: 2 })
  })
})
